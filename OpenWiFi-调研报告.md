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
   - [5.5 设备能力数据模型](#55-设备能力数据模型-capabilities)
   - [5.6 配置数据模型 (configuration.json)](#56-配置数据模型-configurationjson)
   - [5.7 状态与遥测数据模型 (state.json)](#57-状态与遥测数据模型-statejson)
   - [5.8 命令模型 (Commands)](#58-命令模型-commands)
   - [5.9 JSON Schema 校验与 UCI 渲染](#59-json-schema-校验与-uci-渲染)
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

### 5.5 设备能力数据模型 (Capabilities)

AP 首次连接到控制器时，必须上报其完整硬件和软件能力。控制器根据能力信息匹配配置模板。

```json
{
  "capabilities": {
    "model": "EAP101",
    "vendor": "Edgecore",
    "firmware": "APNOS-2.10.0",
    "platform": "ipq807x",
    "radios": [{
      "band": "5G",
      "modes": ["HT", "VHT", "HE", "EHT"],
      "max-width": 160,
      "channels": [36, 40, 44, 48, 149, 153, 157, 161],
      "max-clients": 256,
      "mimo": "4x4:4",
      "antennas": 4
    }, {
      "band": "2G",
      "modes": ["HT", "VHT", "HE"],
      "max-width": 40,
      "channels": [1, 6, 11],
      "max-clients": 128,
      "mimo": "2x2:2",
      "antennas": 2
    }, {
      "band": "6G",
      "modes": ["HE", "EHT"],
      "max-width": 320,
      "channels": [37, 53, 69, 85, 101, 117, 149, 181],
      "max-clients": 256,
      "mimo": "4x4:4",
      "antennas": 4
    }],
    "interfaces": ["WAN", "LAN"],
    "ports": {
      "WAN": {"count": 2, "speed": [1000, 2500, 5000]},
      "LAN": {"count": 4, "speed": [1000]},
      "SFP": {"count": 1, "speed": [10000]}
    },
    "features": [
      "wpa3", "passpoint", "openroaming",
      "wds", "mesh", "802.11k", "802.11v", "802.11r",
      "ofdma", "mu-mimo", "bss-color"
    ]
  }
}
```

| 能力字段 | 类型 | 描述 |
|----------|------|------|
| `model` | string | 设备型号标识 |
| `vendor` | string | 厂商名称 |
| `firmware` | string | 当前固件版本号 |
| `radios[]` | array | 射频模块列表 |
| `radios[].band` | enum | 工作频段: `2G` / `5G` / `6G` |
| `radios[].modes[]` | array | 支持的 Wi-Fi 协议: `HT` (WiFi 4) / `VHT` (WiFi 5) / `HE` (WiFi 6) / `EHT` (WiFi 7) |
| `radios[].max-width` | int | 最大信道带宽 (MHz): 20/40/80/160/320 |
| `radios[].mimo` | string | MIMO 配置: `2x2:2` / `4x4:4` |
| `interfaces[]` | array | 物理接口名称列表 |
| `ports` | object | 物理端口类型、数量和速率 |
| `features[]` | array | 支持的功能特性列表 |

---

### 5.6 配置数据模型 (configuration.json)

uCentral 配置数据模型 (定义于 `wlan-ucentral-schema`) 是设备管理的核心，由 **5 个顶层节点** 组成。每个配置变更附带 MD5 哈希值用于一致性校验。

#### 5.6.1 顶层结构

```json
{
  "uuid": 1234,
  "serial": "AABBCCDDEEFF",
  "hash": "a1b2c3d4e5f6...",
  "unit": { ... },
  "interfaces": [ ... ],
  "services": { ... },
  "metrics": { ... },
  "config-raw": { ... }
}
```

| 字段 | 必须 | 描述 |
|------|:----:|------|
| `uuid` | ✅ | 配置变更序号 (单调递增) |
| `serial` | ✅ | 设备序列号 (MAC 地址无冒号格式) |
| `hash` | ✅ | 配置内容 MD5 哈希值 |
| `unit` | ✅ | 设备基础信息 |
| `interfaces` | ✅ | 接口配置数组 (WAN + LAN + SSID) |
| `services` | ❌ | 系统服务开关 |
| `metrics` | ❌ | 遥测采集策略 |
| `config-raw` | ❌ | 透传 UCI 原始命令 |

#### 5.6.2 unit — 设备基础信息

```json
{
  "unit": {
    "name": "Office-AP-01",
    "description": "Building A, Floor 3",
    "location": "40.7128,-74.0060",
    "timezone": "CST-8",
    "leds-active": true,
    "random-password": false,
    "hostname": ["Office-AP-01", "ap01.internal"]
  }
}
```

| 字段 | 类型 | 描述 |
|------|------|------|
| `name` | string | 设备友好名称 |
| `description` | string | 设备描述 (位置/用途) |
| `location` | string | GPS 坐标 `lat,lng` |
| `timezone` | string | 时区: `CST-8` / `EST5EDT` / `UTC` |
| `leds-active` | bool | 启用/禁用 LED 指示灯 |
| `random-password` | bool | 为 root 用户生成随机密码 |
| `hostname[]` | array | 设备主机名列表 (用于 DNS) |

#### 5.6.3 interfaces — 接口配置

**WAN 口 (上行):**

```json
{
  "interfaces": [{
    "name": "WAN",
    "role": "upstream",
    "services": ["lldp"],
    "ethernet": [{
      "select-ports": ["WAN*"],
      "speed": 2500,
      "duplex": "full",
      "mtu": 1500
    }],
    "ipv4": {
      "addressing": "dynamic",
      "gateway": "192.168.1.1",
      "dns": ["8.8.8.8", "1.1.1.1"]
    },
    "vlan": [{
      "id": 10,
      "proto": "802.1q",
      "ipv4": { "addressing": "static", "subnet": "10.0.10.2/24" }
    }]
  }]
}
```

**LAN 口 + SSID (下行):**

```json
{
  "interfaces": [{
    "name": "LAN",
    "role": "downstream",
    "services": ["ssh", "lldp"],
    "ethernet": [{
      "select-ports": ["LAN1", "LAN2"],
      "speed": 1000
    }],
    "ipv4": {
      "addressing": "static",
      "subnet": "192.168.10.1/24",
      "dhcp": {
        "lease-first": 10,
        "lease-count": 100,
        "lease-time": "6h",
        "relay": {"server": "192.168.10.5"}
      }
    },
    "ssids": [{
      "name": "Corporate-WiFi",
      "wifi-bands": ["5G", "2G", "6G"],
      "bss-mode": "ap",
      "hidden-ssid": false,
      "isolate-clients": false,
      "power": "auto",
      "channel": "auto",
      "channel-width": 80,
      "country": "CN",
      "encryption": {
        "proto": "wpa3",
        "key": "SecurePass!2026",
        "ieee80211w": "required",
        "radius": {
          "server": "192.168.1.10",
          "port": 1812,
          "secret": "RadiusSecret123",
          "nas-identifier": "Office-AP-01"
        }
      },
      "roaming": {
        "message-exchange": "ds",
        "generate-psk": true,
        "domain-identifier": "corp-wifi",
        "pmk-r0-key-holder": "AA:BB:CC:DD:EE:FF"
      },
      "rates": {
        "beacon": 6000,
        "multicast": 24000
      },
      "rrm": {
        "neighbor-reporting": true,
        "bss-transition": true,
        "load-balance": {
          "max-clients": 50,
          "rssi-threshold": -75
        }
      },
      "qos": {
        "wmm": true,
        "dscp-trust": true
      }
    }]
  }]
}
```

#### 5.6.4 接口配置字段详解

| 字段 | 类型 | 描述 |
|------|------|------|
| `name` | string | 接口名称: `WAN` / `LAN` |
| `role` | enum | 接口角色: `upstream` (上行) / `downstream` (下行) |
| `services[]` | array | 启用的服务: `lldp` / `ssh` / `mdns` |
| `ethernet[].select-ports[]` | array | 绑定的物理端口, 支持通配符 `WAN*` |
| `ethernet[].speed` | int | 端口协商速率 (Mbps) |
| `ethernet[].mtu` | int | 最大传输单元 |
| `ipv4.addressing` | enum | IP 获取方式: `dynamic` (DHCP) / `static` / `pppoe` |
| `ipv4.subnet` | cidr | 静态 IP 子网: `192.168.10.1/24` |
| `ipv4.dhcp.lease-first` | int | DHCP 地址池起始偏移 |
| `ipv4.dhcp.lease-count` | int | DHCP 地址池大小 |
| `ipv4.dhcp.lease-time` | duration | 租约时长: `6h` / `24h` / `7d` |
| `vlan[].id` | int | VLAN ID (1–4094) |
| `vlan[].proto` | enum | VLAN 封装: `802.1q` / `802.1ad` |

#### 5.6.5 SSID 配置字段详解

| 字段 | 类型 | 描述 |
|------|------|------|
| `name` | string | SSID 名称 (1–32 字符) |
| `wifi-bands[]` | array | 工作频段: `2G` / `5G` / `6G` |
| `bss-mode` | enum | BSS 模式: `ap` / `wds-ap` / `wds-sta` / `mesh` / `sta` |
| `hidden-ssid` | bool | 隐藏 SSID (不广播) |
| `isolate-clients` | bool | 客户端隔离 (禁止 L2 互通) |
| `power` | int/auto | 发射功率 (dBm), `auto` 为自动调优 |
| `channel` | int/auto | 工作信道编号, `auto` 为自动选择 |
| `channel-width` | int | 信道带宽: 20 / 40 / 80 / 160 / 320 (MHz) |
| `country` | string | 国家代码 (ISO 3166): `CN` / `US` / `DE` |
| `encryption.proto` | enum | 加密协议: `none` / `psk` / `psk2` / `wpa3` / `wpa3-192` |
| `encryption.key` | string | 预共享密钥 (8–63 字符) |
| `encryption.ieee80211w` | enum | PMF 模式: `disabled` / `optional` / `required` |
| `encryption.radius.server` | ip | RADIUS 认证服务器 IP |
| `encryption.radius.port` | int | RADIUS 端口 (默认 1812) |
| `encryption.radius.secret` | string | RADIUS 共享密钥 |
| `roaming.message-exchange` | enum | 漫游消息交换: `ds` (Distribution System) / `air` |
| `roaming.generate-psk` | bool | 为每个客户端生成唯一 PSK |
| `roaming.domain-identifier` | string | 漫游域标识符 (FT 快速漫游用) |
| `rates.beacon` | int | Beacon 帧速率 (kbps), 影响覆盖范围 |
| `rates.multicast` | int | 组播/广播速率 (kbps) |
| `rrm.load-balance.max-clients` | int | 单 SSID 最大客户端数 |
| `rrm.load-balance.rssi-threshold` | int | 信号强度阈值 (dBm), 低于此值拒绝关联 |
| `qos.wmm` | bool | Wi-Fi Multimedia 优先级调度 |
| `qos.dscp-trust` | bool | 信任 IP DSCP 标记到 WMM 映射 |

#### 5.6.6 services — 系统服务

```json
{
  "services": {
    "lldp": {
      "enable": true,
      "describe": "Office-AP",
      "location": {"coordinate": "40.7128,-74.0060"}
    },
    "ssh": {
      "enable": true,
      "port": 22,
      "password-authentication": false,
      "authorized-keys": ["ssh-rsa AAAAB3..."]
    },
    "ntp": {
      "enable": true,
      "server": "ntp.example.com",
      "interval": 3600
    },
    "igmp": { "enable": true },
    "rtty": {
      "enable": true,
      "port": 5912,
      "token": "device-token-here"
    },
    "mdns": {
      "enable": true,
      "reflector": false
    },
    "radius-proxy": {
      "enable": true,
      "server": "192.168.1.10",
      "port": 1812,
      "secret": "ProxySecret",
      "coa": true
    },
    "wifi-steering": {
      "enable": true,
      "mode": "band-steering",
      "rssi-threshold": -70
    },
    "captive": {
      "enable": true,
      "mode": "click-through",
      "url": "https://portal.example.com",
      "session-timeout": "1h",
      "idle-timeout": "15m"
    }
  }
}
```

| 服务 | 描述 |
|------|------|
| `lldp` | Link Layer Discovery Protocol — 邻居发现 |
| `ssh` | Secure Shell — 远程管理 (支持密钥认证) |
| `ntp` | Network Time Protocol — 时间同步 |
| `igmp` | Internet Group Management Protocol — 组播 |
| `rtty` | Remote TTY — 远程终端调试 |
| `mdns` | mDNS — 本地服务发现 |
| `radius-proxy` | RADIUS 代理 — 转发认证请求 |
| `wifi-steering` | 频段引导 — 将客户端引导到 5G/6G |
| `captive` | Captive Portal — 强制认证门户 |

#### 5.6.7 metrics — 遥测采集策略

```json
{
  "metrics": {
    "interval": 60,
    "statistics": {
      "interval": 60,
      "types": ["ssids", "lldp", "clients"]
    },
    "healthchecks": {
      "interval": 120,
      "types": ["cpu", "memory", "temperature", "reachability"]
    },
    "wifi-frames": {
      "interval": 300,
      "mode": "management",
      "filter": ["probe-request", "association-request"]
    },
    "dhcp-snooping": {
      "interval": 180,
      "trusted-ports": ["LAN1"]
    },
    "crashlogs": {
      "enable": true,
      "max-size": 1048576
    }
  }
}
```

| 采集类型 | 默认间隔 | 描述 |
|----------|:------:|------|
| `statistics` | 60s | SSID 统计 / LLDP 邻居 / 客户端列表 |
| `healthchecks` | 120s | CPU / 内存 / 温度 / 网络连通性 |
| `wifi-frames` | 300s | 802.11 管理帧捕获 |
| `dhcp-snooping` | 180s | IP-MAC 绑定表 (客户端指纹) |
| `crashlogs` | 事件驱动 | 崩溃后自动上传诊断数据 |

---

### 5.7 状态与遥测数据模型 (state.json)

AP 定期向控制器上报状态信息。控制器通过 REST API 可查询 `state`、`statistics`、`healthchecks`、`capabilities` 等端点。

#### 5.7.1 设备状态 (state)

```json
{
  "state": {
    "serial": "AABBCCDDEEFF",
    "uuid": 1234,
    "hash": "a1b2c3d4e5f6...",
    "state": "configured",
    "connected": true,
    "uptime": 864000,
    "firmware": "APNOS-2.10.0",
    "last-contact": 1718000000,
    "version": "2.10.0",
    "connection": {
      "protocol": "ws",
      "port": 15002,
      "since": 1717900000,
      "reconnects": 0
    }
  }
}
```

| 字段 | 描述 |
|------|------|
| `state` | 设备状态: `configured` / `upgrading` / `mismatch` / `provisioning` / `disconnected` |
| `connected` | WebSocket 连接状态 |
| `uptime` | 设备运行时间 (秒) |
| `hash` | 当前生效的配置哈希 (与控制器下发比对) |
| `last-contact` | 最后通信时间戳 (Unix epoch) |
| `reconnects` | 重连次数 |

#### 5.7.2 统计遥测 (statistics)

```json
{
  "statistics": {
    "timestamp": 1718000000,
    "ssids": [{
      "name": "Corporate-WiFi",
      "radio": "5G",
      "channel": 36,
      "channel-width": 80,
      "frequency": 5180,
      "clients": 47,
      "tx-bytes": 482910482,
      "rx-bytes": 128394022,
      "tx-packets": 3910234,
      "rx-packets": 981234,
      "tx-errors": 12,
      "rx-errors": 3,
      "tx-retries": 234,
      "noise": -92,
      "channel-utilization": 34.5,
      "air-time": {"tx": 28.3, "rx": 15.7, "busy": 34.5, "free": 21.5}
    }],
    "lldp": [{
      "port": "LAN1",
      "peer-name": "Core-Switch-01",
      "peer-mac": "11:22:33:44:55:66",
      "peer-port": "Gi1/0/1",
      "peer-description": "Core Switch"
    }],
    "clients": [{
      "mac": "AA:BB:CC:DD:EE:FF",
      "ssid": "Corporate-WiFi",
      "radio": "5G",
      "ip": "192.168.10.55",
      "rssi": -48,
      "snr": 42,
      "rx-rate": 866,
      "tx-rate": 650,
      "rx-bytes": 1024000,
      "tx-bytes": 512000,
      "connected": 3600,
      "mode": "802.11ac",
      "mimo": "2x2",
      "wmm": true,
      "power-save": false
    }]
  }
}
```

#### 5.7.3 健康检查遥测 (healthchecks)

```json
{
  "healthchecks": {
    "timestamp": 1718000000,
    "sanity": 100,
    "cpu": {
      "user": 12.3,
      "system": 4.7,
      "nice": 0.1,
      "idle": 82.9,
      "load": [1.2, 0.8, 0.6]
    },
    "memory": {
      "total": 524288,
      "free": 131072,
      "used": 393216,
      "buffers": 32768,
      "cached": 98304,
      "used-percent": 75.0
    },
    "temperature": {
      "cpu": 52,
      "radio-5g": 58,
      "radio-2g": 45,
      "board": 42
    },
    "disk": {
      "total": 262144,
      "free": 131072,
      "used": 131072,
      "used-percent": 50.0
    },
    "reachability": {
      "gateway": true,
      "dns": true,
      "controller": true
    }
  }
}
```

| 指标 | 描述 |
|------|------|
| `sanity` | 综合健康分数 (0–100, 100=完全健康) |
| `cpu.user/system/idle` | CPU 使用率百分比 |
| `cpu.load[]` | 1/5/15 分钟负载均值 |
| `memory.total/free/used` | 内存统计 (KB) |
| `temperature.cpu/radio-5g/radio-2g/board` | 各组件温度 (°C) |
| `reachability.gateway/dns/controller` | 连通性检测 |

#### 5.7.4 WiFi 帧捕获 (wifi-frames)

```json
{
  "wifi-frames": {
    "timestamp": 1718000000,
    "frames": [{
      "type": "probe-request",
      "mac": "AA:BB:CC:DD:EE:FF",
      "ssid": "Corporate-WiFi",
      "radio": "5G",
      "rssi": -55,
      "frequency": 5180
    }, {
      "type": "association-request",
      "mac": "11:22:33:44:55:66",
      "ssid": "Corporate-WiFi",
      "radio": "5G",
      "rssi": -42
    }]
  }
}
```

#### 5.7.5 DHCP Snooping

```json
{
  "dhcp-snooping": {
    "timestamp": 1718000000,
    "bindings": [{
      "mac": "AA:BB:CC:DD:EE:FF",
      "ip": "192.168.10.55",
      "hostname": "laptop-01",
      "port": "LAN1",
      "vlan": 10,
      "lease-time": 86400,
      "server": "192.168.10.1"
    }]
  }
}
```

#### 5.7.6 崩溃日志 (crashlogs)

```json
{
  "crashlogs": {
    "timestamp": 1718000000,
    "reason": "kernel-panic",
    "stack-trace": "Kernel panic - not syncing: Fatal exception...",
    "log": "[  123.456] BUG: unable to handle kernel NULL pointer...",
    "firmware": "APNOS-2.10.0",
    "kernel": "Linux 5.15.120",
    "uptime": 3600
  }
}
```

---

### 5.8 命令模型 (Commands)

控制器可通过 uCentral 向设备发送命令。命令通过 `command` 数组下发，设备按顺序执行并返回结果。

```json
{
  "serial": "AABBCCDDEEFF",
  "commands": [{
    "type": "reboot",
    "when": 0,
    "details": {}
  }, {
    "type": "upgrade",
    "when": 0,
    "details": {
      "uri": "https://firmware.example.com/apnos-2.11.0.bin",
      "sha256": "e3b0c44298fc1c149afbf4c8996fb924...",
      "keep-config": true
    }
  }, {
    "type": "trace",
    "when": 0,
    "details": {
      "interface": "LAN",
      "duration": 60,
      "max-packets": 1000,
      "filter": "port 80"
    }
  }]
}
```

| 命令 | 描述 | 关键参数 |
|------|------|----------|
| `reboot` | 重启设备 | `when`: 延迟秒数 |
| `factory` | 恢复出厂设置 | `keep-ip`: 保留网络配置 |
| `upgrade` | OTA 固件升级 | `uri` (固件 URL) / `sha256` (校验) / `keep-config` |
| `trace` | 远程抓包 | `interface` / `duration` / `filter` (BPF) |
| `leds` | LED 闪烁定位 | `pattern` / `duration` |
| `script` | 执行自定义脚本 | `script` (base64) |
| `request` | 主动请求遥测 | `state` / `statistics` / `healthchecks` |

---

### 5.9 JSON Schema 校验与 UCI 渲染

#### 5.9.1 校验流程

```
Controller                        AP (uCentral Agent)
    │                                   │
    │  ── configure(JSON + hash) ──▶   │
    │                                   ├─ 1. 解析 JSON
    │                                   ├─ 2. JSON Schema 校验
    │                                   │     ├─ 通过 → 继续
    │                                   │     └─ 失败 → 返回 ERROR
    │                                   ├─ 3. ucode 模板渲染 → UCI 批次
    │                                   ├─ 4. uci commit + reload_config
    │                                   ├─ 5. 计算应用后哈希
    │                                   └─ 6. 对比下发哈希
    │                                         ├─ 匹配 → state: "configured"
    │                                         └─ 不匹配 → state: "mismatch"
    │  ◀── state(configured/mismatch) ──│
```

#### 5.9.2 ucode 模板示例 (wlan-ucentral-schema)

ucode 是 OpenWrt 的 JavaScript-like 模板引擎，uCentral 用它实现 JSON → UCI 的渲染：

```javascript
// /usr/share/ucentral/unit.utpl — 渲染 unit 配置
{%=  let cfg = ctx.unit %}
{%=  if (cfg.name) uci.set('system.@system[0].hostname', cfg.name) %}
{%=  if (cfg.location) uci.set('system.@system[0].location', cfg.location) %}
{%=  if (cfg.timezone) uci.set('system.@system[0].timezone', cfg.timezone) %}

// /usr/share/ucentral/ssid.utpl — 渲染 SSID 配置
{%=  for (let i = 0; i < ctx.ssids.length; i++) %}
{%=    let ssid = ctx.ssids[i] %}
{%=    let idx = uci.add('wireless', 'wifi-iface') %}
{%=    uci.set(`wireless.@wifi-iface[${idx}].ssid`, ssid.name) %}
{%=    uci.set(`wireless.@wifi-iface[${idx}].encryption`, ssid.encryption.proto) %}
{%=    if (ssid.encryption.key) uci.set(`wireless.@wifi-iface[${idx}].key`, ssid.encryption.key) %}
{%=    if (ssid.roaming) uci.set(`wireless.@wifi-iface[${idx}].ieee80211r`, '1') %}

// 渲染结果 (UCI 批次命令):
// uci set wireless.@wifi-iface[0].ssid='Corporate-WiFi'
// uci set wireless.@wifi-iface[0].encryption='sae'
// uci commit wireless
// reload_config
```

#### 5.9.3 配置哈希校验机制

```javascript
// Controller 端
config_json = build_configuration(device_capabilities)
config_hash = md5(JSON.stringify(config_json))
send_to_device(config_json, config_hash)

// AP 端 (uCentral Agent)
received = parse_websocket_message()
actual_json = render_uci_and_read_back()  // 应用后读回实际生效配置
actual_hash = md5(JSON.stringify(actual_json))
if (actual_hash === received.hash) {
    report_state("configured", actual_hash)
} else {
    report_state("mismatch", actual_hash)  // 触发 Controller 重发
}
```

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
