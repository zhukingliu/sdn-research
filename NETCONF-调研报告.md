# NETCONF (Network Configuration Protocol) 调研报告

> **调研日期**: 2026年6月11日
> **协议**: NETCONF — RFC 6241 + RFC 8526 (NMDA) + RFC 7950 (YANG 1.1)
> **定位**: IETF 标准化的网络配置管理协议

---

## 目录

1. [概述与背景](#1-概述与背景)
2. [四层架构模型](#2-四层架构模型)
3. [核心协议操作](#3-核心协议操作)
4. [数据存储与事务模型](#4-数据存储与事务模型)
5. [YANG 数据建模语言](#5-yang-数据建模语言)
6. [NETCONF + NMDA 扩展](#6-netconf--nmda-扩展)
7. [与 gNMI / RESTCONF / SNMP 对比](#7-与-gnmi--restconf--snmp-对比)
8. [实际部署案例](#8-实际部署案例)
9. [SDN 控制器集成](#9-sdn-控制器集成)
10. [开发实践示例](#10-开发实践示例)
11. [2025-2026 最新进展](#11-2025-2026-最新进展)
12. [总结与展望](#12-总结与展望)
13. [参考资源](#13-参考资源)

---

## 1. 概述与背景

### 1.1 什么是 NETCONF

**NETCONF (Network Configuration Protocol)** 是 IETF 于 2006 年首次发布的网络配置管理协议，定义于 **RFC 6241**，提供安装、修改和删除网络设备配置的标准化机制。它使用 **XML** 编码，通过**安全、面向连接的传输层** (SSH 为强制要求) 进行 RPC 通信。

> NETCONF 被业界公认为 **"网络配置自动化的基石协议"**，它取代了脆弱的 CLI 屏幕抓取 (screen-scraping)，开启了模型驱动的网络可编程时代。

### 1.2 为什么需要 NETCONF

| 传统 CLI/SNMP 痛点 | NETCONF 解决方案 |
|------|------|
| CLI 输出无结构化，脚本脆弱 | XML 结构化数据，Schema 校验 |
| 配置变更无回滚保障 | 候选数据存储 + commit/rollback 事务 |
| SNMP 不支持配置写入 | edit-config 操作 + 多数据存储支持 |
| 多厂商 CLI 语法不兼容 | 统一 YANG 模型驱动的标准化接口 |
| 无配置校验机制 | validate + test-option 能力 |

### 1.3 发展历程

| 时间 | 里程碑 |
|------|--------|
| 2006 | RFC 4741: NETCONF 1.0 (初始版) |
| 2011 | **RFC 6241**: NETCONF 1.1 (当前基础) |
| 2016 | RFC 7950: **YANG 1.1** 数据建模语言 |
| 2018 | **RFC 8526**: NETCONF Extensions for NMDA |
| 2019 | RFC 8341: NACM 访问控制模型 |
| 2020-2024 | 所有主流厂商 (Cisco/Juniper/Nokia/Huawei/Arista) 全面支持 |
| 2025 | IETF 发布 LLM-IBN NETCONF 差距分析草案 |
| 2026 | RFC 6241 更新至 2026-05-20 版本，增加分页扩展 |

---

## 2. 四层架构模型

### 2.1 架构总览 (RFC 6241)

```
┌─────────────────────────────────────────────────────────┐
│  Layer 4: Content Layer                                 │
│  Configuration + State Data (structured by YANG models)  │
│  <interfaces> <routing> <system> <acl> ...               │
├─────────────────────────────────────────────────────────┤
│  Layer 3: Operations Layer                              │
│  <get-config> <edit-config> <commit> <lock> <validate>   │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Messages Layer                                │
│  <rpc> <rpc-reply> <rpc-error> <notification>            │
├─────────────────────────────────────────────────────────┤
│  Layer 1: Secure Transport Layer                        │
│  SSH (mandatory, port 830) | TLS | SOAP/HTTP/TLS        │
└─────────────────────────────────────────────────────────┘
```

### 2.2 各层职责

| 层 | 职责 | 示例 |
|----|------|------|
| **Content** | 配置和状态数据的结构与语义 | YANG 模型定义的接口、路由、ACL |
| **Operations** | 定义对数据执行的操作 | get-config、edit-config、commit |
| **Messages** | 独立于传输的 RPC 消息框架 | `<rpc>` 请求、`<rpc-reply>` 响应 |
| **Transport** | 安全加密传输 | SSH (830)、TLS (6513) |

### 2.3 会话生命周期

```
Client                                     NETCONF Server
  |                                              |
  |-- SSH Connect (port 830) ------------------->|
  |<-- <hello> (capabilities exchange) ---------|
  |-- <hello> (capabilities exchange) ---------->|
  |                                              |
  |-- <rpc><get-config>...</rpc> --------------->|
  |<-- <rpc-reply><data>...</rpc-reply> --------|
  |                                              |
  |-- <rpc><close-session/> ------------------->|
  |<-- <ok/> -----------------------------------|
  |-- SSH Disconnect --------------------------->|
```

---

## 3. 核心协议操作

### 3.1 操作总览

| 操作 | RFC 6241 | 描述 |
|------|:--------:|------|
| `<get>` | §7.7 | 获取运行配置和状态数据 |
| `<get-config>` | §7.1 | 获取指定数据存储的配置 |
| `<edit-config>` | §7.2 | 修改配置 (merge/replace/create/delete/remove) |
| `<copy-config>` | §7.3 | 复制一个数据存储到另一个 |
| `<delete-config>` | §7.4 | 删除一个数据存储 |
| `<lock>` | §7.5 | 锁定数据存储 (排他写) |
| `<unlock>` | §7.6 | 解锁数据存储 |
| `<close-session>` | §7.8 | 优雅关闭会话 |
| `<kill-session>` | §7.9 | 强制终止其他会话 |
| `<commit>` | §8.3 | 原子提交候选配置 |
| `<discard-changes>` | §8.3.4.1 | 回滚未提交的候选变更 |
| `<validate>` | §8.6.4.1 | 校验候选配置有效性 |

### 3.2 edit-config 操作模式

| 模式 | 描述 |
|------|------|
| **merge** | 合并配置 (默认): 新数据并入现有配置，冲突时覆盖 |
| **replace** | 完全替换: 用新配置替换指定范围的现有配置 |
| **create** | 仅创建: 配置项不存在则创建，存在则报错 |
| **delete** | 删除: 删除指定配置项 |
| **remove** | 移除: 删除指定配置项 (静默，不存在不报错) |

### 3.3 RPC 消息示例

**请求 — 获取接口配置 (get-config):**
```xml
<rpc message-id="101"
     xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <get-config>
    <source><running/></source>
    <filter>
      <interfaces xmlns="urn:ietf:params:xml:ns:yang:ietf-interfaces">
        <interface>
          <name>GigabitEthernet0/0/0</name>
        </interface>
      </interfaces>
    </filter>
  </get-config>
</rpc>
```

**请求 — 修改接口配置 (edit-config):**
```xml
<rpc message-id="102"
     xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <edit-config>
    <target><candidate/></target>
    <config>
      <interfaces xmlns="urn:ietf:params:xml:ns:yang:ietf-interfaces">
        <interface>
          <name>GigabitEthernet0/0/0</name>
          <description>Uplink to Core Switch</description>
          <enabled>true</enabled>
        </interface>
      </interfaces>
    </config>
  </edit-config>
</rpc>
```

**响应 — RPC 错误:**
```xml
<rpc-reply message-id="102"
           xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <rpc-error>
    <error-type>application</error-type>
    <error-tag>invalid-value</error-tag>
    <error-severity>error</error-severity>
    <error-message xml:lang="en">
      Interface 'GigabitEthernet0/0/0' not found
    </error-message>
  </rpc-error>
</rpc-reply>
```

---

## 4. 数据存储与事务模型

### 4.1 经典数据存储 (RFC 6241)

| 数据存储 | 描述 |
|----------|------|
| **running** | 设备当前活动的配置 (正在转发流量) |
| **candidate** | 候选配置暂存区 (可选能力: `:candidate`) |
| **startup** | 下次启动时加载的配置 (可选能力: `:startup`) |

### 4.2 NMDA 数据存储扩展 (RFC 8526)

NMDA (Network Management Datastore Architecture) 将数据存储进一步细分:

| 数据存储 | 描述 |
|----------|------|
| **running** | 运行配置 |
| **intended** | 意图配置 (期望的状态) |
| **operational** | 操作状态 (实际生效的状态) |
| **system** | 系统控制的配置 (不可手动修改) |
| **ephemeral** | 临时配置 (重启后消失) |

### 4.3 事务工作流

```
1. <lock><target><candidate/></target></lock>
2. <edit-config><target><candidate/></target>...</edit-config>
3. <validate><source><candidate/></source></validate>
4a. <commit/>  (原子提交: candidate → running)
    或
4b. <discard-changes/>  (回滚所有候选变更)
5. <unlock><target><candidate/></target></unlock>
```

### 4.4 Confirmed Commit (安全网)

```xml
<rpc message-id="103">
  <commit>
    <confirmed/>
    <confirm-timeout>300</confirm-timeout>  <!-- 5分钟超时 -->
  </commit>
</rpc>
```

> 管理员 5 分钟内未发送 `<commit/>` 确认，设备自动回滚到变更前状态。
> 这是远程配置变更的核心安全保障——防止"把自己锁在外面"。

---

## 5. YANG 数据建模语言

### 5.1 YANG 模型结构

YANG (RFC 7950) 是 NETCONF 配套的数据建模语言，定义配置和状态数据的层次结构、类型约束和语义。

```yang
module example-interface {
  namespace "http://example.com/interface";
  prefix "exif";

  container interfaces {
    list interface {
      key "name";
      leaf name { type string; }
      leaf description { type string; }
      leaf enabled { type boolean; default true; }
      leaf mtu { type uint16 { range "64..9216"; } }
      container state {
        config false;  // 仅状态数据，不可配置
        leaf oper-status {
          type enumeration {
            enum up;
            enum down;
          }
        }
      }
    }
  }
}
```

### 5.2 YANG 关键特性

| 特性 | 描述 |
|------|------|
| **config false** | 标记只读状态数据 (与配置数据分离) |
| **must 约束** | XPath 表达式定义跨节点约束 |
| **when 条件** | 条件性数据节点存在性 |
| **typedef** | 可复用的类型定义 |
| **augment** | 扩展现有模型而不修改原文件 |
| **deviation** | 声明设备对标准模型的偏离 |
| **feature** | 标记可选功能 |

### 5.3 常用 YANG 模型

| YANG 模块 | RFC | 描述 |
|-----------|-----|------|
| ietf-interfaces | RFC 8343 | 接口管理 |
| ietf-ip | RFC 8344 | IPv4/IPv6 路由管理 |
| ietf-routing | RFC 8349 | 路由协议管理 |
| ietf-system | RFC 7317 | 系统基础管理 |
| ietf-acl | RFC 8519 | 访问控制列表 |
| openconfig-interfaces | OpenConfig | 跨厂商接口模型 |

---

## 6. NETCONF + NMDA 扩展

### 6.1 NMDA (RFC 8526) 增强

NMDA 为 NETCONF 引入了 `<get-data>` 操作，替代传统的 `<get-config>` 和 `<get>`:

```xml
<rpc message-id="201">
  <get-data xmlns="urn:ietf:params:xml:ns:yang:ietf-netconf-nmda">
    <datastore>operational</datastore>
    <subtree-filter>
      <interfaces xmlns="urn:ietf:params:xml:ns:yang:ietf-interfaces"/>
    </subtree-filter>
  </get-data>
</rpc>
```

### 6.2 能力交换增强

NETCONF Hello 消息中声明的能力决定可选操作:

```
<hello>
  <capabilities>
    <capability>urn:ietf:params:netconf:base:1.1</capability>
    <capability>urn:ietf:params:netconf:capability:candidate:1.0</capability>
    <capability>urn:ietf:params:netconf:capability:confirmed-commit:1.1</capability>
    <capability>urn:ietf:params:netconf:capability:yang-library:1.0</capability>
  </capabilities>
</hello>
```

### 6.3 分页扩展 (2025)

2025 年 IETF 草案新增分页支持，增强 `<get>`, `<get-config>`, `<get-data>`:

```xml
<rpc>
  <get-config>
    <source><running/></source>
    <filter>...</filter>
    <pagination xmlns="urn:ietf:params:xml:ns:yang:ietf-netconf-pagination">
      <offset>0</offset>
      <limit>100</limit>
      <sort-by>name</sort-by>
    </pagination>
  </get-config>
</rpc>
```

---

## 7. 与 gNMI / RESTCONF / SNMP 对比

| 维度 | **NETCONF** | **gNMI** | **RESTCONF** | **SNMP** |
|------|:---:|:---:|:---:|:---:|
| **标准化** | IETF RFC 6241 | OpenConfig | IETF RFC 8040 | IETF RFC 1157 |
| **传输** | SSH (830) | gRPC/HTTP2 (57400) | HTTPS (443) | UDP (161) |
| **序列化** | XML | Protobuf | JSON/XML | ASN.1 BER |
| **数据模型** | IETF YANG | OpenConfig YANG | IETF YANG | MIB (OID) |
| **候选数据存储** | ✅ | ❌ | ❌ | ❌ |
| **原子提交** | ✅ (commit) | ❌ (单消息事务) | ❌ | N/A |
| **确认提交** | ✅ (confirmed-commit) | ❌ | ❌ | N/A |
| **配置回滚** | ✅ (discard/rollback) | 有限 | ❌ | N/A |
| **校验 (dry-run)** | ✅ (validate) | ❌ | ❌ | ❌ |
| **锁机制** | ✅ (lock/unlock) | ❌ | ❌ | ❌ |
| **流式遥测** | ❌ (polling only) | ✅ (subscribe) | ❌ (polling only) | ❌ (polling only) |
| **学习曲线** | 较高 | 中等 | 低 | 低 |
| **最佳场景** | 核心网*事务配置* | AI 网络*流式遥测* | DevOps *快速 API* | 基础*监控* |

---

## 8. 实际部署案例

| 案例 | 描述 |
|------|------|
| **Cisco NSO** | 网络服务编排器，通过 NETCONF 管理数万台设备，原子事务跨域配置下发 |
| **AT&T SDN** | ECOMP/ONAP 控制器使用 NETCONF 作为主要南向协议，管理核心路由器和 BGP 策略 |
| **Juniper Junos** | 原生 NETCONF 支持 (2008 年始)，所有 CLI 操作均有对应 NETCONF XML RPC |
| **Nokia SR OS** | 运营商级路由器通过 NETCONF + YANG 实现零接触部署和日切变更 |
| **OpenDaylight** | 开源 SDN 控制器，NETCONF 南向插件支持 YANG 模型的动态挂载 |
| **CERN 数据中心** | 使用 NETCONF 管理大型科学计算网络交换机，实现变更窗口自动化 |

---

## 9. SDN 控制器集成

### 9.1 NETCONF 在 SDN 架构中的角色

```
┌────────────────────────────────────────────┐
│          SDN Controller (ODL/ONOS/NSO)       │
│  ┌──────────────────────────────────────┐   │
│  │  YANG Model-Driven Service Layer    │   │
│  │  (Intent → YANG Translation)        │   │
│  └──────────┬───────────────────────────┘   │
│             │                                │
│  ┌──────────▼───────────────────────────┐   │
│  │  NETCONF Southbound Plugin           │   │
│  │  - Dynamic YANG Model Mounting       │   │
│  │  - Transaction Orchestrator          │   │
│  │  - Commit Coordinator                │   │
│  └──────────┬───────────────────────────┘   │
└─────────────┼────────────────────────────────┘
              │ NETCONF over SSH (port 830)
    ┌─────────┼──────────┬──────────┐
    ▼         ▼          ▼          ▼
 [Router] [Switch] [Firewall] [Load Balancer]
```

### 9.2 OpenDaylight NETCONF 集成

```bash
# ODL 挂载 NETCONF 设备
curl -u admin:admin -H "Content-Type: application/xml" \
  -X POST http://localhost:8181/restconf/config/network-topology:network-topology/topology/topology-netconf/node/device-1 \
  -d '
<node xmlns="urn:TBD:params:xml:ns:yang:network-topology">
  <node-id>device-1</node-id>
  <host xmlns="urn:opendaylight:netconf-node-topology">192.168.1.1</host>
  <port xmlns="urn:opendaylight:netconf-node-topology">830</port>
  <credentials xmlns="urn:opendaylight:netconf-node-topology">
    <username>admin</username>
    <password>admin123</password>
  </credentials>
</node>'
```

### 9.3 Ansible 自动化

```yaml
- name: Configure interfaces via NETCONF
  hosts: switches
  tasks:
    - name: Set interface description
      netconf_config:
        host: "{{ inventory_hostname }}"
        username: admin
        password: admin123
        target: candidate
        content: |
          <config>
            <interfaces xmlns="urn:ietf:params:xml:ns:yang:ietf-interfaces">
              <interface>
                <name>GigabitEthernet0/0/0</name>
                <description>Uplink to Core</description>
              </interface>
            </interfaces>
          </config>

    - name: Commit changes
      netconf_config:
        host: "{{ inventory_hostname }}"
        username: admin
        password: admin123
        target: candidate
        operation: commit
```

---

## 10. 开发实践示例

### 10.1 Python ncclient

```python
from ncclient import manager

# 连接到 NETCONF 设备
with manager.connect(
    host='192.168.1.1',
    port=830,
    username='admin',
    password='admin123',
    hostkey_verify=False,
    device_params={'name': 'csr'}  # 或 'junos', 'huawei'
) as m:
    # 获取接口配置
    reply = m.get_config(
        source='running',
        filter=('subtree', '''
          <interfaces xmlns="urn:ietf:params:xml:ns:yang:ietf-interfaces">
            <interface><name>GigabitEthernet0/0/0</name></interface>
          </interfaces>
        ''')
    )
    print(reply.xml)

    # 修改配置 (候选数据存储 + 事务提交)
    config = '''
    <config>
      <interfaces xmlns="urn:ietf:params:xml:ns:yang:ietf-interfaces">
        <interface>
          <name>GigabitEthernet0/0/0</name>
          <description>Uplink to Core Switch</description>
          <enabled>true</enabled>
        </interface>
      </interfaces>
    </config>
    '''

    m.lock(target='candidate')
    m.edit_config(target='candidate', config=config)
    m.validate(source='candidate')  # dry-run 校验
    m.commit()  # 原子提交
    m.unlock(target='candidate')

    # Confirmed Commit (5分钟安全网)
    m.edit_config(target='candidate', config=config)
    m.commit(confirmed=True, timeout='300')
    # ... 验证网络连通性 ...
    m.commit()  # 确认提交，或等待超时自动回滚
```

### 10.2 开发环境快速搭建

```bash
# 1. 启动 NETCONF 模拟设备 (基于 Containerlab)
cat > netconf-lab.yml << EOF
name: netconf-lab
topology:
  nodes:
    router1:
      kind: nokia_srlinux
      image: ghcr.io/nokia/srlinux
    router2:
      kind: cisco_xrd
      image: xrd-control-plane:7.8.1
EOF
sudo containerlab deploy -t netconf-lab.yml

# 2. 验证 NETCONF 连接
ssh -p 830 admin@router1 -s netconf

# 3. Hello 消息交换
# 输入:
<?xml version="1.0" encoding="UTF-8"?>
<hello xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <capabilities>
    <capability>urn:ietf:params:netconf:base:1.0</capability>
  </capabilities>
</hello>
]]>]]>
# (服务器会回复其 Hello 和能力列表)
```

---

## 11. 2025-2026 最新进展

### 11.1 LLM-Driven IBN 差距分析

IETF 于 2025 年 11 月发布了草案 **draft-zeng-opsawg-llm-netconf-gap-00**，系统分析了 NETCONF 在 LLM 驱动的意图网络 (IBN) 中的差距:

| 差距领域 | 描述 |
|----------|------|
| **语义发现缺失** | YANG 模型无法在运行时自描述，LLM 无法动态理解模型语义 |
| **多设备关联上下文** | NETCONF 会话间不共享意图 ID 或跨设备关联信息 |
| **高频 KPI 遥测** | NETCONF Notification 机制吞吐量有限，不适用于亚秒级 KPI |
| **细粒度鉴权/审计** | commit 是原子操作，无法按 leaf 级别进行 RBAC 控制 |

### 11.2 NETCONF 分页扩展

2025 年新增的 `ietf-netconf-pagination` YANG 模块解决了大规模 YANG list 的检索性能问题，支持 `offset/limit/cursor/sort-by` 参数。

### 11.3 三大协议互补策略

业界共识 (Cisco、Arista、Asterfusion、PLVision 等): **不存在"统一协议"**，最佳实践是多协议互补:

```
            ┌─────────────────┐
            │   SDN Controller │
            └───┬───────┬─────┘
                │       │
      ┌─────────▼┐  ┌──▼──────────┐
      │ NETCONF  │  │    gNMI     │
      │ (事务配置)│  │ (流式遥测)   │
      │ SSH:830  │  │ gRPC:57400  │
      └──────────┘  └─────────────┘
```

---

## 12. 总结与展望

### 12.1 核心优势

1. **事务完整性:** 候选数据存储 + commit/rollback + confirmed-commit，配置变更有安全网
2. **模型驱动:** YANG 数据模型确保配置 Schema 校验，消除 CLI 错误
3. **标准化 (IETF):** 跨厂商兼容，RFC 级别的互操作保障
4. **成熟度:** 近 20 年演进，SDN 控制器广泛支持
5. **ACID 哲学:** lock → edit → validate → commit (全或无)

### 12.2 当前局限

1. **XML 臃肿:** XML 编码比二进制编码带宽消耗大 ~60%
2. **SSH 连接开销:** 大规模并发管理时 SSH 连接数成为瓶颈
3. **无推送遥测:** 仅支持 polling 式的状态查询
4. **YANG 复杂度:** 编写和维护 YANG 模型需要专业知识

### 12.3 未来方向

- **NETCONF 分页标准化:** 解决百万级 YANG list 检索性能
- **LLM 集成:** 增强运行时语义发现，让 LLM 理解设备 YANG 模型
- **与 gNMI 互补融合:** 控制器同时支持 NETCONF (配置) + gNMI (遥测) 成为标配
- **JSON 编码支持:** 社区讨论在 NETCONF 中加入 JSON 作为可选编码

---

## 13. 参考资源

| 资源 | URL |
|------|-----|
| RFC 6241 | https://datatracker.ietf.org/doc/rfc6241/ |
| RFC 8526 (NMDA) | https://datatracker.ietf.org/doc/rfc8526/ |
| RFC 7950 (YANG 1.1) | https://datatracker.ietf.org/doc/rfc7950/ |
| RFC 8040 (RESTCONF) | https://datatracker.ietf.org/doc/rfc8040/ |
| IETF LLM-IBN Gap Analysis | https://datatracker.ietf.org/doc/draft-zeng-opsawg-llm-netconf-gap-00/ |
| ncclient Python SDK | https://github.com/ncclient/ncclient |
| YANG Suite (Cisco) | https://github.com/CiscoDevNet/yangsuite |
| OpenDaylight NETCONF | https://docs.opendaylight.org/projects/netconf/ |
| Containerlab | https://containerlab.dev/ |

---

> **声明:** 本文档基于公开资料整理，仅供 SDN 技术研究参考。所有商标归各自所有者拥有。
