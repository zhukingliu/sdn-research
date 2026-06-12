# gNMI (gRPC Network Management Interface) 调研报告

> **调研日期**: 2026年6月11日
> **协议**: gNMI — gRPC Network Management Interface
> **规范来源**: OpenConfig Working Group + Google

---

## 目录

1. [概述与背景](#1-概述与背景)
2. [协议栈与核心架构](#2-协议栈与核心架构)
3. [四大 RPC 操作详解](#3-四大-rpc-操作详解)
4. [Subscribe 流式遥测机制](#4-subscribe-流式遥测机制)
5. [数据模型: OpenConfig YANG](#5-数据模型-openconfig-yang)
6. [客户端工具与实践](#6-客户端工具与实践)
7. [与 NETCONF / RESTCONF / SNMP 对比](#7-与-netconf--restconf--snmp-对比)
8. [实际部署案例](#8-实际部署案例)
9. [AI 时代与 SDN 融合](#9-ai-时代与-sdn-融合)
10. [开发实践示例](#10-开发实践示例)
11. [总结与展望](#11-总结与展望)
12. [参考资源](#12-参考资源)

---

## 1. 概述与背景

### 1.1 什么是 gNMI

**gNMI (gRPC Network Management Interface)** 是由 Google 与 **OpenConfig** 工作组联合开发的新一代网络管理协议。它使用 **gRPC** (基于 HTTP/2) 作为传输层，**Protocol Buffers (protobuf)** 作为二进制序列化格式，为网络设备提供统一的配置管理与状态监控接口。

> gNMI 被设计为"单一协议解决 SNMP 的监控低效 + NETCONF 的流式遥测缺失"困境，是云原生网络的基石协议。

### 1.2 设计动机

| 痛点 (传统协议) | gNMI 解决方案 |
|------|------|
| SNMP 轮询效率低、不支持配置 | Push-based 流式遥测 + Set() 配置操作 |
| NETCONF 仅支持 XML 轮询 | Protobuf 二进制编码 + 订阅式推送 |
| 厂商私有 MIB 碎片化 | OpenConfig 统一 YANG 模型 |
| 缺乏实时性 | 亚秒级 ON_CHANGE 推送 |
| 带宽和 CPU 开销高 | gRPC/HTTP2 多路复用 + Protobuf 压缩 |

### 1.3 发展历程

| 时间 | 里程碑 |
|------|--------|
| 2016 | Google 与 OpenConfig 工作组发布 gNMI 初始规范 |
| 2018 | gNMI v0.4.0 发布，核心 RPC 定义稳定 |
| 2020-2023 | Cisco、Juniper、Arista、Nokia 等主流厂商全面支持 |
| 2024 | gNMI v0.10.0，增强扩展性 + gRPC Server Reflection |
| 2025 | SONiC 社区全面集成 gNMI，国内星融元发布 AsterNOS gNMI 方案 |
| 2026 | gNMI 成为 AI 训练网络 (RoCE/InfiniBand) 监控的事实标准 |

---

## 2. 协议栈与核心架构

### 2.1 协议栈层次

```
┌─────────────────────────────────────────────────────────┐
│              OpenConfig YANG Models (数据模式层)          │
│          interfaces / routing / telemetry / QoS ...       │
├─────────────────────────────────────────────────────────┤
│           gNMI RPC Interface (接口层)                      │
│     Capabilities  │  Get  │  Set  │  Subscribe            │
├─────────────────────────────────────────────────────────┤
│           gRPC Framework (传输层)                          │
│     HTTP/2 · Bidirectional Streaming · TLS 1.3           │
├─────────────────────────────────────────────────────────┤
│           Protocol Buffers (序列化层)                      │
│     Binary encoding · Schema-driven · Backward compat     │
└─────────────────────────────────────────────────────────┘
```

### 2.2 核心架构角色

| 角色 | 描述 | 端口 |
|------|------|------|
| **gNMI Client** | 网络管理系统 / SDN 控制器 / 自动化脚本 | — |
| **gNMI Server (Target)** | 网络设备 (路由器/交换机/防火墙) | TCP 57400 (IANA 注册) |
| **OpenConfig YANG Models** | 数据结构定义，决定 Get/Set/Subscribe 的 Path 语义 | — |

### 2.3 通信模型

- **单向 RPC:** Capabilities、Get、Set (Client → Server → Response)
- **双向流 RPC:** Subscribe (Client ⇄ Server，持续推送)
- **多路复用:** 单条 HTTP/2 连接可承载多个并发流
- **安全:** 基于 TLS 1.3 的双向认证 (mTLS)

---

## 3. 四大 RPC 操作详解

### 3.1 Capabilities — 能力发现

**用途:** 客户端首次连接时查询设备支持的 YANG 模型、编码格式、gNMI 版本。

**请求示例 (gnmic CLI):**
```bash
gnmic -a 192.168.1.1:57400 --insecure capabilities
```

**响应内容:**
- `supported_models:` 支持的 YANG 模块列表 (name + organization + version)
- `supported_encodings:` JSON / JSON_IETF / PROTO / BYTES / ASCII
- `gNMI_version:` 协议版本号
- `extensions:` 支持的扩展 (如 master_arbitration)

### 3.2 Get — 快照读取

**用途:** 检索设备配置/状态数据的**一次性快照** (pull 模式)。

| 参数 | 描述 |
|------|------|
| `prefix` | 公共路径前缀 |
| `path` | YANG 模型路径 (XPath 风格) |
| `type` | ALL \| CONFIG \| STATE \| OPERATIONAL |
| `encoding` | JSON \| JSON_IETF \| PROTO \| BYTES |

**示例:**
```bash
# 获取接口状态数据
gnmic -a 192.168.1.1:57400 get \
  --path "/interfaces/interface[name=Ethernet1]/state" \
  --type STATE
```

### 3.3 Set — 配置修改

**用途:** 修改设备配置，支持三种操作类型。

| 操作 | Proto 字段 | 描述 |
|------|-----------|------|
| **Update** | `update` | 创建或更新指定路径的配置 (upsert) |
| **Replace** | `replace` | 替换指定路径的配置 (先删后建) |
| **Delete** | `delete` | 删除指定路径的配置 |

**示例:**
```bash
# 设置接口描述
gnmic -a 192.168.1.1:57400 set \
  --update-path "/interfaces/interface[name=Ethernet1]/config/description" \
  --update-value "Uplink-to-Core"
```

### 3.4 Subscribe — 流式遥测订阅 (核心差异化能力)

见下一章详解。

---

## 4. Subscribe 流式遥测机制

### 4.1 订阅模式

| 模式 | 触发方式 | 用途 |
|------|----------|------|
| **ONCE** | 单次快照后关闭流 | 等价于 Get，通过流方式返回 |
| **POLL** | 客户端主动发起 poll | 客户端驱动的按需采样 |
| **STREAM** | 服务端持续推送 | 实时遥测 (核心场景) |

### 4.2 STREAM 子模式

| 子模式 | 触发条件 | 典型间隔 | 场景 |
|--------|----------|----------|------|
| **SAMPLE** | 定时采样 | 1s ~ 600s | 常规监控、容量规划 |
| **ON_CHANGE** | 值变更时推送 | 亚秒级 | 链路状态、BGP peer 变更 |
| **TARGET_DEFINED** | 设备自行决定 | 自动 | 厂商优化策略 |

### 4.3 订阅工作流

```
Client                          gNMI Target Device
  |                                      |
  |-- SubscribeRequest ----------------->|   (定义 path + mode + interval)
  |                                      |
  |<-- SubscribeResponse (sync=true) ----|   (初始同步: 当前状态)
  |<-- SubscribeResponse (update) -------|   (持续推送: 增量变更)
  |<-- SubscribeResponse (update) -------|
  |<-- SubscribeResponse (update) -------|
  |                                      |
  |  ... continuous streaming ...        |
```

### 4.4 ON_CHANGE 的内部实现

设备端通过 **gRPC Server-side streaming** 维护一个长期存活的 RPC 连接。当 YANG 叶子节点值发生变化时 (通常由底层硬件中断或内核事件触发)，gNMI Server 自动构造 `SubscribeResponse` 并推送给所有匹配订阅。

> ON_CHANGE 在 AI 训练网络中尤为关键: 可以实时检测 RoCE 网络中的 PFC (Priority Flow Control) 暂停帧、ECN 标记、缓冲区拥塞等微秒级事件。

---

## 5. 数据模型: OpenConfig YANG

### 5.1 OpenConfig 组织

OpenConfig 是由 Google、Microsoft、AT&T、BT 等大型网络运营商组成的开放工作组，目标是定义**厂商无关的网络配置与遥测数据模型**。

### 5.2 模型覆盖范围

| 模型类别 | 典型 Path | 描述 |
|----------|-----------|------|
| **Interface** | `/interfaces/interface[name=Ethernet1]/state/counters` | 接口统计 |
| **Routing** | `/network-instances/network-instance/protocols/protocol/bgp` | BGP 路由协议 |
| **Telemetry** | `/telemetry-system/sensor-groups/...` | 遥测策略配置 |
| **QoS** | `/qos/interfaces/interface/input/classifiers/...` | 质量管理 |
| **ACL** | `/acl/acl-sets/acl-set/...` | 访问控制 |
| **LLDP** | `/lldp/interfaces/interface/neighbors/...` | 链路发现 |
| **Platform** | `/components/component/state/temperature` | 平台硬件监控 |

### 5.3 YANG Path 结构

```
/interfaces/interface[name=Ethernet1]/state/counters/in-octets
  └─ module root
       └─ container (keyed list)
            └─ state container
                 └─ counters container
                      └─ leaf (uint64)
```

### 5.4 编码格式支持

| 编码 | 数据大小 | 解析速度 | 适用场景 |
|------|:--------:|:--------:|----------|
| **PROTO** (protobuf) | ⭐⭐⭐ 最小 | ⭐⭐⭐ 最快 | 生产遥测、大规模流式 |
| **JSON_IETF** | ⭐⭐ | ⭐⭐ | 兼容 IETF YANG 标准 |
| **JSON** | ⭐⭐ | ⭐⭐ | 开发调试、HTTP 集成 |
| **BYTES** | ⭐⭐⭐ | ⭐⭐⭐ | 高性能场景 |
| **ASCII** | ⭐ | ⭐ | 人工可读性 |

---

## 6. 客户端工具与实践

### 6.1 gnmic (OpenConfig 官方推荐)

```bash
# 安装
curl -sL https://github.com/openconfig/gnmic/releases/download/v0.37.0/gnmic_0.37.0_linux_amd64.tar.gz | tar xz

# 基础使用
gnmic -a 192.168.1.1:57400 --insecure \
  subscribe \
  --path "/interfaces/interface/state/counters" \
  --mode stream \
  --stream-mode sample \
  --sample-interval 10s
```

### 6.2 ygnmi (Go SDK)

```go
import "github.com/openconfig/ygnmi/ygnmi"

client, _ := ygnmi.NewClient(ctx, "192.168.1.1:57400")
path := ygnmi.Lookup[uint64](
    ctx, client,
    oc.Interfaces().Interface("Ethernet1").State().Counters().InOctets(),
)
```

### 6.3 Telegraf gNMI Input Plugin

```toml
[[inputs.gnmi]]
  addresses = ["192.168.1.1:57400"]
  [[inputs.gnmi.subscription]]
    name = "interfaces"
    path = "/interfaces/interface/state/counters"
    subscription_mode = "sample"
    sample_interval = "30s"
```

---

## 7. 与 NETCONF / RESTCONF / SNMP 对比

| 维度 | **gNMI** | **NETCONF** | **RESTCONF** | **SNMP** |
|------|:---:|:---:|:---:|:---:|
| **传输** | gRPC/HTTP2 | SSH | HTTPS | UDP |
| **序列化** | Protobuf (binary) | XML (text) | JSON/XML | ASN.1 BER |
| **配置操作** | ✅ Set (update/replace/delete) | ✅ edit-config (事务) | ✅ PUT/PATCH | ❌ |
| **流式遥测** | ✅ Subscribe (push) | ❌ (仅 polling) | ❌ (仅 polling) | ❌ (仅 polling) |
| **数据模型** | OpenConfig YANG | IETF YANG | IETF YANG | MIB (OID) |
| **效率** | ⭐⭐⭐ 极高 | ⭐⭐ 中等 | ⭐⭐ 中等 | ⭐ 低 |
| **事务语义** | 单消息内事务 | ✅ 多步事务 + 回滚 | ❌ 无事务 | N/A |
| **AI 网络适配** | ✅ 亚秒级推流 | ⚠️ 不支持 | ⚠️ 不支持 | ❌ |
| **学习曲线** | 中等 | 较高 | 低 | 低 |
| **默认端口** | 57400 | 830 | 443 | 161/162 |

---

## 8. 实际部署案例

| 案例 | 描述 |
|------|------|
| **Google B4 SD-WAN** | 大规模全球 SDN 骨干网，gNMI 替代 SNMP 实现全网毫秒级遥测 |
| **Microsoft Azure** | 数据中心交换机配置管理，基于 gNMI + OpenConfig 的统一管控面 |
| **Sonic (Azure SONiC)** | 开源交换机 OS 中原生集成 gNMI，支持所有主要白盒交换机 |
| **Asterfusion AsterNOS** | 国内商用 SONiC 发行版，2025 年发布基于 YANG 的 gNMI 管理方案 |
| **Nokia SR Linux** | 数据中心 Fabric 控制器 NDAC 通过 gNMI 管理 SR Linux 交换机 |
| **Juniper Apstra** | 意图网络控制器通过 gNMI 下发配置和采集遥测 |
| **AI 训练集群** | GPU 集群 RoCE 网络通过 gNMI ON_CHANGE 监控 PFC/ECN 微突发 |

---

## 9. AI 时代与 SDN 融合

### 9.1 gNMI 在 AI 训练网络的价值

- **亚秒级微突发检测:** GPU 间 RDMA 通信对丢包极为敏感，gNMI ON_CHANGE 可实时捕获 PFC 暂停帧激增
- **闭环自动调优:** 遥测数据 → AI 分析引擎 → Set() 下发优化策略 → 验证效果
- **全栈可观测:** 从光模块温度到 BGP 路由表，统一 Path 模型
- **LLM-Driven IBN 的基础:** gNMI 的模型驱动特性使其成为 LLM 翻译意图到设备配置的首选协议

### 9.2 gNMI 在 SDN 架构中的定位

```
            ┌──────────────────────┐
            │   SDN 控制器 / NMS    │
            │  (ONOS / ODL / 自研)  │
            └──────┬───────────────┘
                   │
       ┌───────────┼───────────┐
       │           │           │
   gNMI         NETCONF    OpenFlow
 (遥测+配置)   (事务配置)  (流表控制)
       │           │           │
       ▼           ▼           ▼
  ┌─────────────────────────────────┐
  │      网络设备 (白盒/传统)        │
  └─────────────────────────────────┘
```

---

## 10. 开发实践示例

### 10.1 gNMI 一键环境搭建

```bash
# 1. 启动 gNMI 模拟目标设备
docker run -d --name gnmi-target -p 57400:57400 \
  ghcr.io/openconfig/gnmi-target:latest

# 2. 安装 gnmic
curl -sL https://github.com/openconfig/gnmic/releases/download/v0.37.0/gnmic_0.37.0_linux_amd64.tar.gz | tar xz
sudo mv gnmic /usr/local/bin/

# 3. 发现设备能力
gnmic -a localhost:57400 --insecure capabilities

# 4. 流式订阅接口计数器
gnmic -a localhost:57400 --insecure subscribe \
  --path "/interfaces/interface/state/counters" \
  --mode stream --stream-mode sample --sample-interval 5s
```

### 10.2 Python gNMI 客户端 (via pygnmi)

```python
from pygnmi import gNMIclient

# 连接设备
with gNMIclient(
    target=('192.168.1.1', 57400),
    username='admin',
    password='admin123',
    insecure=True
) as gc:
    # Capabilities
    caps = gc.capabilities()
    print(f"Supported models: {[m['name'] for m in caps['supported_models']]}")

    # Get - 获取接口状态
    result = gc.get(
        path=['/interfaces/interface[name=Ethernet1]/state'],
        encoding='json_ietf'
    )

    # Set - 修改接口描述
    gc.set(
        update=[
            ('/interfaces/interface[name=Ethernet1]/config/description',
             'Uplink-to-Core')
        ]
    )

    # Subscribe - 流式遥测
    subscription = gc.subscribe(
        subscribe={
            'interfaces': {
                'path': '/interfaces/interface/state/counters',
                'mode': 'stream',
                'stream_mode': 'sample',
                'sample_interval': 10000000000  # 10s in ns
            }
        }
    )
    for response in subscription:
        print(response)
```

---

## 11. 总结与展望

### 11.1 核心优势

1. **单一协议 + 双向能力:** 同时支持配置 (Set) 和遥测 (Subscribe)
2. **亚秒级实时性:** ON_CHANGE 推送延迟可达毫秒级
3. **协议高效:** Protobuf 二进制编码比 XML 节省 ~60% 带宽
4. **云原生设计:** gRPC/HTTP2 自然适配容器化和微服务架构
5. **生态成熟:** 主流厂商全支持 + OpenConfig 统一模型

### 11.2 当前挑战

1. **事务语义弱:** Set() 不支持跨路径的原子事务回滚 (NETCONF 的强项)
2. **运维门槛:** gRPC + Protobuf 调试复杂度高于 REST/JSON
3. **YANG 模型学习曲线:** OpenConfig 模型数量庞大，Path 定位需要经验
4. **安全配置:** mTLS 证书管理在大规模部署中仍较复杂

### 11.3 趋势展望

- **AI Fabric 标配:** 2026-2027 年，gNMI 将成为 GPU 集群网络监控的事实标准
- **LLM + gNMI:** LLM 直接生成 gNMI Path 和 Set/Subscribe 请求，实现意图驱动网络
- **gNMI 2.0 演进:** 预期增加多路径事务支持、原生 gRPC Reflection 增强
- **与 NETCONF 互补融合:** 大型部署中 gNMI (遥测) + NETCONF (配置事务) 将成为标准组合

---

## 12. 参考资源

| 资源 | URL |
|------|-----|
| gNMI 规范 | https://github.com/openconfig/gnmi |
| OpenConfig YANG Models | https://github.com/openconfig/public |
| gnmic 工具 | https://github.com/openconfig/gnmic |
| ygnmi Go SDK | https://github.com/openconfig/ygnmi |
| pygnmi Python SDK | https://github.com/nokia/pygnmi |
| Google gnxi 参考实现 | https://github.com/google/gnxi |
| SONiC gNMI | https://github.com/sonic-net/sonic-gnmi |
| IETF 网络管理协议对比 | https://datatracker.ietf.org/doc/draft-zeng-opsawg-llm-netconf-gap-00/ |

---

> **声明:** 本文档基于公开资料整理，仅供 SDN 技术研究参考。所有商标归各自所有者拥有。
