# SDN Research

SDN (Software Defined Networking) 技术研究仓库，专注于网络协议与开源网络技术方案的深度调研和分析。

> 🌐 在线浏览: [https://zhukingliu.github.io/sdn-research/](https://zhukingliu.github.io/sdn-research/)

## 📄 调研报告

| 报告 | 在线版 | Markdown | 描述 |
|------|:------:|:--------:|------|
| **TIP OpenWiFi** | [🌐](openwifi.html) | [📝](OpenWiFi-调研报告.md) | 开源企业级 Wi-Fi 系统架构、CloudSDK、APNOS、uCentral 协议、WiFi 7 |
| **gNMI** | [🌐](gnmi.html) | [📝](gNMI-调研报告.md) | gRPC 网络管理接口、流式遥测、OpenConfig YANG、AI 网络监控 |
| **NETCONF** | [🌐](netconf.html) | [📝](NETCONF-调研报告.md) | IETF 标准配置协议、YANG 建模、ACID 事务语义、SDN 集成 |
| **SNMP** | [🌐](snmp.html) | [📝](SNMP-调研报告.md) | 网络管理基石协议、MIB/OID、v1/v2c/v3、USM/VACM、Java SNMP4J |

## 🔬 研究方向

- 网络管理与自动化 (NETCONF / gNMI / RESTCONF)
- 开源 Wi-Fi 系统 (TIP OpenWiFi / OpenWrt)
- 软件定义网络 (SDN) 控制平面
- 网络功能虚拟化 (NFV)
- 白盒网络设备生态
- AI 训练网络 (RoCE / InfiniBand) 可观测性

## 📁 仓库结构

```
sdn-research/
├── index.html                  # 门户首页 (3 张专题卡片)
├── openwifi.html               # OpenWiFi 完整调研报告
├── gnmi.html                   # gNMI 完整调研报告
├── netconf.html                # NETCONF 完整调研报告
├── snmp.html                   # SNMP 完整调研报告
├── OpenWiFi-调研报告.md         # OpenWiFi Markdown 原文
├── gNMI-调研报告.md             # gNMI Markdown 原文
├── NETCONF-调研报告.md          # NETCONF Markdown 原文
├── SNMP-调研报告.md             # SNMP Markdown 原文
├── assets/
│   ├── css/style.css           # 赛博朋克风格样式
│   └── js/main.js              # 粒子引擎 + 导航 + 交互
└── .github/workflows/deploy.yml # GitHub Pages 自动部署
```

## 🔧 部署

本站基于 GitHub Pages + GitHub Actions 自动部署。

## 许可

本仓库文档采用 CC BY 4.0 许可。
