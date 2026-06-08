# TIP OpenWiFi 开源Wi-Fi系统调研报告

> **调研日期**: 2026年6月8日
> **项目**: Telecom Infra Project (TIP) OpenWiFi
> **版本聚焦**: OpenWiFi 4.0 (WiFi 7)

---

## 目录

1. [概述与背景](#1-概述与背景)
2. [核心架构](#2-核心架构)
3. [CloudSDK 云控制器](#3-cloudsdk-云控制器)
4. [AP 固件与NOS](#4-ap-固件与nos)
5. [uCentral 通信协议](#5-ucentral-通信协议)
6. [OpenSync 融合层](#6-opensync-融合层)
7. [WiFi 7 与 OpenWiFi 4.0](#7-wifi-7-与-openwifi-40)
8. [多厂商互操作性](#8-多厂商互操作性)
9. [实际部署案例](#9-实际部署案例)
10. [生态与合作伙伴](#10-生态与合作伙伴)
11. [与同类方案对比](#11-与同类方案对比)
12. [SDN 研究视角下的 OpenWiFi](#12-sdn-研究视角下的-openwifi)
13. [总结与展望](#13-总结与展望)
14. [参考资源](#14-参考资源)

---

## 1. 概述与背景

### 1.1 什么是 TIP OpenWiFi

**TIP OpenWiFi** 是由 **Telecom Infra Project (TIP)** 旗下的 Open Converged Wireless (OCW) 项目组于 2021 年 5 月推出的**开源、社区驱动、解耦的企业级 Wi-Fi 软件系统**。它是 TIP OpenLAN 工作组孵化的首个开源项目，核心使命是"让优质 Wi-Fi 体验民主化" (Democratize Premium Wi-Fi Experiences)。

> OpenWiFi 被业界描述为 **"全球首个 CI/CD 开源 Wi-Fi 生态系统"** ，具备每日构建 (Nightly Build) 和自动化 RF 暗室测试 (RF Chamber Testing) 能力。

OpenWiFi 将无线通信领域 "Open RAN" 的理念引入 Wi-Fi 世界——通过软硬件完全解耦，打破传统闭源厂商锁定。

### 1.2 项目历史与动机

| 时间 | 里程碑 |
|------|--------|
| 2021年5月 | TIP OCW 项目组正式启动 OpenWiFi |
| 2021-2022 | OpenWiFi 1.0/2.0 发布，支持 WiFi 5/6 |
| 2022年11月 | 都柏林市政府 + Virgin Media 完成 WiFi4EU 试点 |
| 2023年 | Boingo 首次商业 WiFi 6E OpenWiFi 部署 |
| 2024年 | OpenWiFi 社区参与者突破 300 家 |
| 2025年 | Edgecore Wi-Fi 发布全栈 OpenWiFi POC Kit |
| 2025年 | **OpenWiFi 4.0 发布，正式支持 WiFi 7** |

### 1.3 核心设计原则

1. **完全解耦 (Fully Disaggregated):** AP 硬件、AP 固件 (NOS)、云控制器 (CloudSDK) 各自独立
2. **开放接口 (Open API):** 基于 OpenAPI 标准的 RESTful 北向接口
3. **多厂商互操作 (Multi-Vendor Interoperability):** 不同品牌 AP 可接入同一套云控制器
4. **云原生部署 (Cloud-Native):** Docker Compose / Kubernetes (Helm) 部署
5. **开源社区驱动 (Community-Driven):** 所有代码托管于 GitHub，Apache-2.0 许可证

---

## 2. 核心架构

### 2.1 三层架构总览

```
┌──────────────────────────────────────────────────────────────┐
│                    北向 REST API (OpenAPI)                      │
│          OSS/BSS 系统  │  Portal  │  第三方集成                  │
├──────────────────────────────────────────────────────────────┤
│                      CloudSDK 云控制器层                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│  │  OWGW   │ │  OWSEC  │ │  OWFMS  │ │ OWPROV  │ │OWANALYTICS│ │
│  │ (网关)  │ │ (安全)  │ │ (固件)  │ │ (配置)  │ │ (分析)   │ │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ │
│  ┌─────────┐ ┌─────────┐                                     │
│  │  OWSUB  │ │  Dashboard                                   │ │
│  │ (订阅)  │ │  (管理面板)                                   │ │
│  └─────────┘ └─────────┘                                     │
├──────────────────────────────────────────────────────────────┤
│                  uCentral 协议 (WebSocket/TLS)                  │
├──────────────────────────────────────────────────────────────┤
│                    AP 固件层 (APNOS)                             │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  OpenWrt 基础 + OpenSync 融合层 + WiFi 驱动            │    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────┐│    │
│  │  │ WiFi 4 │ │ WiFi 5 │ │ WiFi 6 │ │WiFi 6E │ │WiFi 7││    │
│  │  │802.11n │ │802.11ac│ │802.11ax│ │802.11ax│ │802.11││    │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └──────┘│    │
│  └──────────────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────────────┤
│                  白盒 AP 硬件层 (Qualcomm/Broadcom 芯片)         │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 三大核心组件

| 组件 | 描述 |
|------|------|
| **开源 AP 固件 (APNOS)** | 基于 OpenWrt 的企业级 AP 网络操作系统，支持 Qualcomm 主流 Wi-Fi 芯片平台 |
| **CloudSDK 云控制器** | 云原生、开源的 Wi-Fi 管控平台，提供 RESTful 北向 API (NBI) 用于集中化管理 |
| **OpenSync 中间层** | 开源网关/路由/设备固件中间层，提供跨芯片平台的灵活控制与遥测接口 |

### 2.3 内部通信机制

- **AP ↔ 控制器**: uCentral 协议通过 WebSocket (端口 15002) + 双向 TLS 认证 (DigiCert 证书体系)
- **控制器微服务间**: Apache Kafka 消息队列
- **北向 API**: OpenAPI 规范定义的 RESTful 接口 (端口 16002 HTTPS)
- **遥测数据**: MQTT 发布的客户端/AP/网络指标

---

## 3. CloudSDK 云控制器

CloudSDK 是 OpenWiFi 的云端管控核心，采用**微服务架构**，通过 Docker Compose 或 Helm Charts 在云环境中部署。

### 3.1 微服务组件详解

| 微服务 | 全称 | 功能 |
|--------|------|------|
| **OWGW** | OpenWiFi Gateway | 设备网关核心，管理与 AP 的 uCentral 协议 WebSocket 通信 |
| **OWSEC** | OpenWiFi Security | 基于 RBAC 的角色访问控制，用户认证与授权 |
| **OWFMS** | OpenWiFi Firmware Management | 固件版本管理与 OTA 升级编排 |
| **OWPROV** | OpenWiFi Provisioning | 设备零接触配置 (ZTP)，证书管理与配置下发 |
| **OWANALYTICS** | OpenWiFi Analytics | 遥测数据分析、可视化与告警 |
| **OWSUB** | OpenWiFi Subscription | 用户/租户订阅管理，多租户隔离 |

### 3.2 关键功能清单

| 功能 | 描述 |
|------|------|
| **零接触部署 (ZTP)** | AP 上电自动发现控制器、自动下载证书、自动配置上线 |
| **固件管理** | 集中式 OTA 固件升级，支持分批灰度发布 |
| **数据模型驱动配置** | 基于模板的设备配置下发，配置变更哈希校验 |
| **RADIUS 配置管理** | 支持 Enterprise WPA2/WPA3 的 RADIUS 认证配置 |
| **高级射频控制 (RRM)** | 自动信道选择、功率控制、BSS 色彩管理 |
| **客户端引导** | 802.11k (定向引导)、802.11v (网络辅助漫游)、802.11r (快速 BSS 切换) |
| **远程排障** | Syslog、合成客户端 (Synthetic Client)、远程 Shell (RTTY)、远程抓包、飞行记录器 |
| **MQTT 遥测** | 实时推送客户端、AP、网络层面的性能指标 |

### 3.3 默认端口与通信路径

```
AP 设备 ──WebSocket (15002)──→ OWGW ──Kafka──→ 其他微服务
外部系统 ──REST HTTPS (16002)──→ 北向 API
远程终端 ──RTTY (5912/5913)──→ AP Shell
```

### 3.4 部署方式

```bash
# GitHub 仓库
https://github.com/Telecominfraproject/wlan-cloud-ucentralgw

# 部署工具
- Docker Compose (开发/POC 环境)
- Helm Charts (生产 Kubernetes 集群)
```

---

## 4. AP 固件与 NOS

### 4.1 APNOS 概述

OpenWiFi 接入点运行 **APNOS (AP Network Operating System)**，基于 **OpenWrt** 构建，专门针对企业级 Wi-Fi 场景进行定制和优化。

### 4.2 硬件平台支持

目前主要支持 **Qualcomm** 系列 Wi-Fi 芯片平台，覆盖以下硬件厂商：

| 厂商 | 代表型号 | 支持标准 |
|------|----------|----------|
| Edgecore | EAP101, EAP105 | WiFi 6/7 |
| HFCL | IO 系列 | WiFi 5/6 |
| Actiontec | (多款) | WiFi 6 |
| Indio Networks | (多款) | WiFi 5/6 |
| Lindsay Broadband | (多款) | WiFi 6 |

部分型号内置 **BLE、Zigbee、Thread** 等 IoT 协议支持，通过 802.3at PoE 供电。

### 4.3 无线功能矩阵

| 功能 | WiFi 4 (n) | WiFi 5 (ac) | WiFi 6 (ax) | WiFi 6E | WiFi 7 |
|------|:----------:|:-----------:|:-----------:|:-------:|:-------:|
| 基础连接 | ✅ | ✅ | ✅ | ✅ | ✅ |
| BSS Coloring | — | — | ✅ | ✅ | ✅ |
| UL/DL OFDMA | — | — | ✅ | ✅ | ✅ |
| 1024-QAM | — | — | ✅ | ✅ | ✅ |
| 4096-QAM | — | — | — | — | ✅ |
| 6GHz 频段 | — | — | — | ✅ | ✅ |
| MLO (多链路操作) | — | — | — | — | ✅ |
| Preamble Puncturing | — | — | — | — | ✅ |
| Channel Switch Announcement | ✅ | ✅ | ✅ | ✅ | ✅ |

### 4.4 组网与安全特性

**网络拓扑支持:**
- 桥接模式 (Bridging)
- VLAN (802.1Q 每 SSID)
- NAT 网关模式
- 本地分流 (Local Breakout)
- Overlay 组网

**安全特性:**
- WPA2 Personal / Enterprise
- WPA3 Personal / Enterprise
- Protected Management Frames (PMF / 802.11w)
- Passpoint® Release 2+ (Hotspot 2.0)
- OpenRoaming 支持
- Captive Portal (本地 + 云端管理)
- 每 SSID 速率限制
- 空口公平性 (Airtime Fairness)

### 4.5 高可靠设计

- **双 Bank 引导加载程序 (Dual-Bank Bootloader):** 固件升级失败自动回退
- **AP 间通信:** 客户端会话信令，支持无缝漫游
- **Maverick 离线配置模式:** 无法连接云端时自动启动本地 Web 配置界面

---

## 5. uCentral 通信协议

### 5.1 协议概述

uCentral 是 OpenWiFi 定义的 **AP 设备与云控制器之间的标准管理协议**。它是 OpenWiFi 实现多厂商互操作性的核心基础。

### 5.2 协议设计

| 特性 | 描述 |
|------|------|
| **传输层** | WebSocket (端口 15002) |
| **安全层** | 双向 TLS (DigiCert 设备证书) |
| **数据格式** | JSON |
| **设备标识** | 每台 AP 具有唯一 ID (序列号) |
| **配置模式** | 数据模型驱动，基于设备能力协商 |
| **配置一致性** | 配置变更生成唯一哈希值，设备上报状态时校验 |

### 5.3 工作流程

```
1. AP 上电 → 发起 WebSocket 连接 (携带设备证书)
2. 控制器验证证书 → 建立双向 TLS 通道
3. AP 上报设备能力 (Capability Report)
4. 控制器根据设备能力下发配置 (Configuration)
5. AP 定期上报状态 (Status / Health / Telemetry)
6. 配置变更时，控制器推送新配置 (Push Configuration)
```

### 5.4 Maverick 离线模式

当 AP 出厂后首次上电无法连接云端时，自动进入 Maverick 模式：

- 广播 SSID `Maverick` 的本地 Wi-Fi
- 本地 Web 管理界面: `http://192.168.1.1` (用户名: `root`, 密码: `openwifi`)
- 支持配置:
  - WAN 连接方式 (PPPoE、4G/5G APN、静态 IP)
  - 云端控制器重定向地址
  - 手动上传设备证书

---

## 6. OpenSync 融合层

### 6.1 概述

OpenSync 是 OpenWiFi 架构中的**网关/路由/设备固件中间层**，提供跨芯片平台的灵活控制与遥测接口。最初由 Plume 开发并贡献给 TIP 社区。

### 6.2 核心价值

| 维度 | 说明 |
|------|------|
| **芯片平台抽象** | 在 Qualcomm、Broadcom 等不同芯片平台之上提供统一管理接口 |
| **标准化遥测** | 统一的数据采集与上报格式 (MQTT) |
| **控制平面分离** | 将设备管理逻辑从底层硬件中解耦 |
| **可扩展性** | 支持第三方插件与自定义功能扩展 |

### 6.3 架构位置

```
┌─────────────────────────┐
│   CloudSDK 控制器        │
├─────────────────────────┤
│   uCentral 协议 (管理)   │
│   OpenSync 协议 (遥测)   │
├─────────────────────────┤
│   APNOS (OpenWrt)        │
│   ├── uCentral Client    │
│   ├── OpenSync Agent     │
│   └── Wi-Fi 驱动          │
├─────────────────────────┤
│   芯片平台 (Qualcomm 等) │
└─────────────────────────┘
```

---

## 7. WiFi 7 与 OpenWiFi 4.0

### 7.1 版本概览

**OpenWiFi 4.0** 是 TIP OpenWiFi 工作组于 2025 年发布的重大版本更新，首次引入对 IEEE 802.11be (WiFi 7) 的全面支持。

### 7.2 WiFi 7 关键新特性

| 特性 | 技术细节 | 收益 |
|------|----------|------|
| **MLO (多链路操作)** | 终端可同时在 2.4GHz/5GHz/6GHz 多频段上发送和接收数据 | 提升吞吐量、降低延迟、提高可靠性 |
| **4096-QAM** | 调制阶数从 1024-QAM 提升至 4096-QAM | 单流速率提升约 20% |
| **320MHz 信道带宽** | 6GHz 频段支持超宽信道 | 理论峰值速率达 46 Gbps |
| **Preamble Puncturing** | 允许在有干扰的子信道上打孔传输 | 提高频谱利用率 |
| **Multi-RU** | 单用户可分配多个资源单元 | 提升频谱调度灵活性 |
| **Multi-AP Coordination** | 多 AP 协同传输 (C-OFDMA, C-SR) | 减少 AP 间干扰 |

### 7.3 OpenWiFi 4.0 架构增强

- **APNOS 内核升级至 OpenWrt 23.05+**
- **新增 WiFi 7 驱动框架与 HAL 抽象层**
- **CloudSDK 新增 MLO 策略管理与 Wi-Fi 7 RRM 优化**
- **支持 6GHz AFC (自动频率协调) 监管合规**
- **WiFi 7 性能自动化 CI 测试框架**

### 7.4 兼容性

OpenWiFi 4.0 向下兼容 WiFi 6/6E/5/4 的 AP 和客户端设备，支持混合部署。

---

## 8. 多厂商互操作性

### 8.1 互操作架构

这是 OpenWiFi 区别于所有闭源方案的**最核心价值**：

```
同一套 CloudSDK 控制器
    ├── 厂商 A 的 AP (WiFi 6)
    ├── 厂商 B 的 AP (WiFi 6E)
    ├── 厂商 C 的 AP (WiFi 7)
    └── 厂商 D 的 AP (WiFi 5)
         ↓
    统一的 uCentral 协议
    统一的配置模型
    统一的遥测格式
```

### 8.2 认证设备白名单

OpenWiFi 社区维护经过认证的互操作设备列表 (Approved Device List)，包括：

- **AP 硬件:** Edgecore、HFCL、Actiontec、Indio Networks、Lindsay Broadband、Inventum 等
- **云控制器:** NetExperience、HFCL、Wavespot、Indio Networks、Inventum 等

### 8.3 互操作测试

- 社区运营 OpenWiFi Community Lab (与 CableLabs 合作)
- 自动化 RF 暗室测试 (Nightly)
- 互操作合规认证程序 (Certification Program)

---

## 9. 实际部署案例

| 部署案例 | 地区 | 详情 |
|----------|------|------|
| **都柏林市政 + Virgin Media** | 爱尔兰 🇮🇪 | WiFi 6 公共 Wi-Fi 试点，符合欧盟 WiFi4EU 计划；NetExperience 云控制器 + Edgecore/HFCL AP |
| **Boingo Wireless** | 美国 🇺🇸 | 首个商用 WiFi 6E OpenWiFi 部署，覆盖机场、体育场等高密度场景 |
| **Spectra** | 印度 🇮🇳 | 多住户单元 (MDU) 和企业园区部署，使用 Inventum AP + 控制器 |
| **CableLabs** | 美国 🇺🇸 | 验证 OpenWiFi v2.9，建立 OpenWiFi Community Lab 供有线电视运营商测试 |
| **Multinet** | 巴基斯坦 🇵🇰 | 托管 Wi-Fi 商业服务 |
| **ThinkWiFi & Mawingu** | 肯尼亚 🇰🇪 | 新兴市场 Wi-Fi 接入服务部署 |
| **Druid Software + TIP** | 爱尔兰 🇮🇪 | 与私有 5G 核心网融合，探索 Wi-Fi/蜂窝融合场景 |

---

## 10. 生态与合作伙伴

### 10.1 社区规模

- **超过 300 家**企业和组织参与
- GitHub Stars 持续增长 (wlan-docs 主仓库)
- 活跃的 Slack 社区与技术工作组

### 10.2 参与者类别

| 类别 | 代表成员 |
|------|----------|
| **服务提供商** | Boingo、Spectra、Virgin Media、Multinet |
| **OEM/ODM** | Edgecore、HFCL、Actiontec、Indio Networks |
| **软件 ISV** | NetExperience、Wavespot、Inventum |
| **系统集成商** | (多家全球和区域 SI) |
| **芯片厂商** | Qualcomm、Broadcom |
| **行业组织** | WBA (Wireless Broadband Alliance)、CableLabs、Wi-Fi Alliance |

### 10.3 代码仓库

| 仓库 | 描述 |
|------|------|
| `Telecominfraproject/wlan-docs` | 核心文档与架构说明 |
| `Telecominfraproject/wlan-cloud-ucentralgw` | CloudSDK 云控制器网关 (OWGW) |
| `routerarchitects/ra-wlan-cloud-ucentralgw` | OWGW 社区维护分支 |
| 其他 APNOS/OpenSync 相关仓库 | AP 固件及 OpenSync 相关组件 |

---

## 11. 与同类方案对比

### 11.1 开源 Wi-Fi 方案对比

| 维度 | **TIP OpenWiFi** | **OpenWrt** | **OpenWISP** | **CoovaChilli** |
|------|:---:|:---:|:---:|:---:|
| **定位** | 企业级全栈解耦 Wi-Fi 系统 | 通用嵌入式路由器 OS | 网络管理与自动化 | Captive Portal |
| **云控制器** | ✅ 原生 CloudSDK | ❌ 需自建 | ✅ 集中管理 | ❌ |
| **多厂商互操作** | ✅ 核心设计目标 | 部分 (同芯片) | 部分 | N/A |
| **WiFi 7 支持** | ✅ (4.0) | ✅ (社区) | 待验证 | N/A |
| **ZTP** | ✅ 原生支持 | ❌ | 部分 | ❌ |
| **标准化北向 API** | ✅ OpenAPI REST | ❌ | ✅ REST | ❌ |
| **RF 管理 (RRM)** | ✅ 内置 | ❌ | ❌ | N/A |
| **社区规模** | 300+ 企业 | 极大规模 | 中型 | 小型 |
| **许可证** | Apache-2.0 | GPLv2 | GPLv3 | GPLv3 |
| **部署复杂度** | 中等 (需 Docker/K8s) | 低 | 中等 | 低 |
| **适用场景** | 运营商/企业/智慧城市 | SOHO/DIY/C PE | ISP/社区网络 | Hotspot |

### 11.2 与闭源方案对比 (如 Aruba/Cisco/Meraki)

| 维度 | **OpenWiFi** | **传统闭源方案** |
|------|:---:|:---:|
| **硬件锁定** | ❌ 任意认证白盒 AP | ✅ 必须同品牌 |
| **控制器许可费** | ❌ 开源免费 | ✅ 按 AP 或功能收费 |
| **API 开放性** | ✅ 完全开放 | ⚠️ 受限 / 需额外许可 |
| **定制化** | ✅ 完全可定制 | ⚠️ 有限 / 需原厂支持 |
| **社区创新速度** | ✅ 快 | ⚠️ 依赖厂商路线图 |
| **商业支持** | ⚠️ 社区 + 第三方 | ✅ 原厂技术支持 |
| **TCO (总拥有成本)** | 低 | 中-高 |

---

## 12. SDN 研究视角下的 OpenWiFi

### 12.1 OpenWiFi 与 SDN 的契合度

OpenWiFi 的架构设计与 SDN 核心理念高度一致，可以被视为 **"无线领域的 SDN"**：

| SDN 原则 | OpenWiFi 实现 |
|-----------|---------------|
| **控制与转发分离** | CloudSDK (控制面) ↔ AP (数据/转发面) |
| **集中式管控** | CloudSDK 提供全网统一管理视图 |
| **开放可编程接口** | OpenAPI 北向接口，支持自动化编排 |
| **硬件白盒化** | 认证白盒 AP，软件与硬件解耦 |
| **网络虚拟化** | 多 SSID + VLAN + Overlay 组网 |

### 12.2 值得关注的 SDN 研究方向

1. **WiFi 与 5G/6G 融合:** OpenWiFi + Open RAN 融合架构设计
2. **AI/ML 驱动的 RRM:** 利用 CloudSDK 遥测数据训练智能射频优化模型
3. **OpenRoaming 与 Federation:** 跨运营商 Wi-Fi 漫游的联邦认证架构
4. **基于意图的 Wi-Fi 网络 (Intent-Based Networking):** 在北向 API 上构建意图翻译层
5. **WiFi TSN (Time-Sensitive Networking):** 面向工业场景的低延迟 Wi-Fi
6. **Green Wi-Fi:** 基于 AI 的 AP 休眠与唤醒策略节能

### 12.3 潜在研究切入点

- **控制器联邦:** 多域 OpenWiFi 控制器的水平扩展与联邦机制
- **AP 边缘计算:** 在 APNOS 上集成轻量级边缘计算框架
- **Intent-Based Configuration:** 用自然语言描述 Wi-Fi 策略，自动翻译为 OpenWiFi 配置

---

## 13. 总结与展望

### 13.1 核心优势

1. **真正的开源解耦:** 从芯片到云端的全栈开源，无锁定风险
2. **成本优势显著:** 无控制器许可费，AP 采购灵活多样化
3. **创新速度快:** 社区驱动的 CI/CD 每日构建，新功能快速落地
4. **生态持续壮大:** 300+ 企业参与，涵盖芯片、硬件、软件、运营商全链条
5. **WiFi 7 就绪:** OpenWiFi 4.0 已全面支持 WiFi 7，领先多数闭源方案

### 13.2 当前挑战

1. **企业级支持体系:** 尚不如 Aruba/Cisco 等成熟厂商完善
2. **文档与培训:** 开源项目文档质量参差不齐
3. **认证互操作规模:** 认证设备型号数量仍需扩充
4. **容器化运维门槛:** 需要 Docker/K8s 运维能力
5. **国内生态:** 中国厂商参与度和部署案例相对较少

### 13.3 趋势展望

- **WiFi 7 规模化部署:** 预计 2026-2027 年 OpenWiFi 4.0 将驱动新一轮 AP 升级周期
- **AI-Native RRM:** 社区已开始探索 AI/ML 在射频优化的应用
- **WiFi + 5G 融合:** TIP OpenLAN 与 OpenRAN 的融合场景将进一步深化
- **边缘计算集成:** APNOS 可能成为边缘计算节点
- **中国市场机遇:** 国内白盒交换机生态 (如星融元 Asterfusion) 已有 OpenWiFi 相关探索

---

## 14. 参考资源

### 14.1 官方链接

| 资源 | URL |
|------|-----|
| TIP OpenWiFi 官方文档 | [github.com/Telecominfraproject/wlan-docs](https://github.com/Telecominfraproject/wlan-docs) |
| CloudSDK (OWGW) | [github.com/Telecominfraproject/wlan-cloud-ucentralgw](https://github.com/Telecominfraproject/wlan-cloud-ucentralgw) |
| OWGW 社区分支 | [github.com/routerarchitects/ra-wlan-cloud-ucentralgw](https://github.com/routerarchitects/ra-wlan-cloud-ucentralgw) |
| TIP OpenLAN 主页 | [telecominfraproject.com/openlan](https://www.telecominfraproject.com/openlan) |

### 14.2 参考文章

- [Dublin City Council, Virgin Media trial TIP OpenWiFi — Mobile Europe](https://www.mobileeurope.co.uk/dublin-city-council-virgin-media-trial-tip-openwifi-pilots/)
- [Spectra expands TIP OpenWiFi architecture in India — RCR Wireless](https://www.rcrwireless.com/20230126/asia-pacific/spectra-expands-tip-openwifi-architecture-in-india)
- [Edgecore Wi-Fi Launches Full-Stack OpenWiFi POC Kit](https://wifi.edge-core.com/news/press-release/edgecorewifi-launches-full-stack-openwifi-poc-kit/)
- [什么是 TIP OpenWiFi？ — 星融元 Asterfusion](https://asterfusion.com/blog20230814-openwifi/)
- [TIP OpenWiFi Subgroup Unveils OpenWiFi 4.0 with WiFi 7 Support](https://www.telecominfraproject.com/post/tip-openwifi-subgroup-unveils-openwifi-4-0-with-wifi-7-support)
- [Edgecore Wi-Fi Advances OpenWiFi Movement with Full-Stack Open Networking Roadmap](https://www.thefastmode.com/technology-solutions/46890-edgecore-wi-fi-advances-openwifi-movement-with-full-stack-open-networking-roadmap)

---

> **声明:** 本文档基于公开资料整理，仅供 SDN 技术研究参考。文中所有商标归各自所有者拥有。
> **下次更新:** 建议关注 OpenWiFi 4.0 WiFi 7 AP 认证设备数量增长及国内生态进展。
