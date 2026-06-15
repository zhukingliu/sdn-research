# RESTCONF (RFC 8040) 调研报告

> **调研日期**: 2026年6月14日
> **协议**: RESTCONF — RESTful Configuration Protocol
> **标准**: RFC 8040 + RFC 8072 (YANG Patch) + RFC 8525 (YANG Library)
> **定位**: YANG 数据模型的 HTTP RESTful 接口，NETCONF 的 Web 友好替代方案

---

## 目录

1. [概述与背景](#1-概述与背景)
2. [核心架构](#2-核心架构)
3. [HTTP CRUD 操作映射](#3-http-crud-操作映射)
4. [YANG 数据模型访问](#4-yang-数据模型访问)
5. [查询参数与高级功能](#5-查询参数与高级功能)
6. [YANG Patch (RFC 8072)](#6-yang-patch-rfc-8072)
7. [与 NETCONF / gNMI 对比](#7-与-netconf--gnmi-对比)
8. [实际部署案例](#8-实际部署案例)
9. [2025-2026 最新进展](#9-2025-2026-最新进展)
10. [开发实践: Java REST API](#10-开发实践-java-rest-api)
11. [总结与展望](#11-总结与展望)
12. [参考资源](#12-参考资源)

---

## 1. 概述与背景

### 1.1 什么是 RESTCONF

**RESTCONF (RESTful Configuration Protocol)** 是 IETF 于 2017 年发布的标准化协议 (RFC 8040)，定义了一个基于 **HTTP** 的编程接口，用于访问 **YANG** 数据模型定义的数据，利用 **NETCONF 定义的数据存储概念**。

> RESTCONF = YANG 数据模型 + HTTP RESTful API + JSON/XML 双编码。它将网络配置管理带入了 Web 开发者的舒适区。

### 1.2 设计动机

| 痛点 | RESTCONF 解决方案 |
|------|------|
| NETCONF 的 SSH/XML 栈对 Web 开发者不友好 | 标准 HTTPS + JSON，curl/Postman 即可调试 |
| 传统 SNMP 轮询粒度粗 | 基于 YANG 的模型驱动 API，结构化数据 |
| 需要与 CI/CD、微服务集成 | RESTful 风格，自然适配 HTTP 生态 |

### 1.3 发展历程

| 时间 | 里程碑 |
|------|--------|
| 2017 | **RFC 8040**: RESTCONF 正式发布 |
| 2017 | RFC 8072: **YANG Patch** 媒体类型 |
| 2019 | RFC 8525: **YANG Library** (模型发现) |
| 2020-2023 | Cisco IOS-XE、Juniper Junos、Nokia SR OS 全面支持 |
| 2024 | SONiC mgmt-framework 实现 RESTCONF Go Server |
| 2025 | IETF 推进 RESTCONF 分页扩展 (limit/offset/cursor/sort) |
| 2026 | RESTCONF 成为 Web 驱动网络自动化的首选接口 |

---

## 2. 核心架构

### 2.1 协议层次

```
┌───────────────────────────────────────────────────┐
│           RESTCONF Client                          │
│  (curl / Python requests / Java HttpClient / NSO)  │
├───────────────────────────────────────────────────┤
│           HTTP Methods (GET/POST/PUT/PATCH/DELETE) │
├───────────────────────────────────────────────────┤
│           HTTPS (TLS 1.3)                          │
├───────────────────────────────────────────────────┤
│           RESTCONF Server                          │
│  ┌─────────────────────────────────────────────┐  │
│  │ /restconf/data          ← CRUD on resources │  │
│  │ /restconf/operations    ← YANG RPC/Actions  │  │
│  │ /restconf/yang-library-version               │  │
│  │ /.well-known/host-meta  ← Discovery          │  │
│  └─────────────────────────────────────────────┘  │
├───────────────────────────────────────────────────┤
│           YANG Datastores (running)                │
└───────────────────────────────────────────────────┘
```

### 2.2 顶层资源 (Root Resources)

| 资源路径 | 描述 |
|----------|------|
| `/restconf/data` | YANG 配置和状态数据的 CRUD 入口 |
| `/restconf/operations` | YANG 定义的 RPC 和 Action 操作 |
| `/restconf/yang-library-version` | YANG Library 版本信息 |
| `/.well-known/host-meta` | RESTCONF 服务发现入口 (RFC 6415) |

### 2.3 媒体类型

| 媒体类型 | 编码 | 用途 |
|----------|:----:|------|
| `application/yang-data+xml` | XML | YANG 数据序列化 |
| `application/yang-data+json` | JSON | YANG 数据序列化 (推荐) |
| `application/yang-patch+xml` | XML | YANG Patch 操作 (RFC 8072) |
| `application/yang-patch+json` | JSON | YANG Patch 操作 |

---

## 3. HTTP CRUD 操作映射

### 3.1 方法对照表

| HTTP 方法 | YANG 操作 | 描述 |
|-----------|-----------|------|
| **GET** | Read | 检索资源 (配置 + 状态数据) |
| **POST** | Create / Invoke | 创建子资源或调用 YANG RPC |
| **PUT** | Create or Replace | 创建或完全替换目标资源 |
| **PATCH** | Merge Update | 部分更新 (plain patch) 或 YANG Patch (RFC 8072) |
| **DELETE** | Delete | 删除目标资源 |
| **OPTIONS** | Discover | 查询资源支持的 HTTP 方法 |
| **HEAD** | Read Headers | 与 GET 相同但仅返回响应头 |

### 3.2 CRUD 操作示例

```bash
# GET — 读取接口配置
curl -u admin:admin -H "Accept: application/yang-data+json" \
  https://192.168.1.1/restconf/data/ietf-interfaces:interfaces

# POST — 创建新接口
curl -u admin:admin -H "Content-Type: application/yang-data+json" \
  -X POST https://192.168.1.1/restconf/data/ietf-interfaces:interfaces \
  -d '{"interface":[{"name":"Loopback0","type":"iana-if-type:softwareLoopback","enabled":true}]}'

# PUT — 完全替换接口配置
curl -u admin:admin -H "Content-Type: application/yang-data+json" \
  -X PUT https://192.168.1.1/restconf/data/ietf-interfaces:interfaces/interface=Loopback0 \
  -d '{"interface":[{"name":"Loopback0","type":"iana-if-type:softwareLoopback","description":"Updated"}]}'

# PATCH — 部分更新接口描述
curl -u admin:admin -H "Content-Type: application/yang-data+json" \
  -X PATCH https://192.168.1.1/restconf/data/ietf-interfaces:interfaces/interface=Loopback0 \
  -d '{"interface":[{"description":"New Description"}]}'

# DELETE — 删除接口
curl -u admin:admin -X DELETE \
  https://192.168.1.1/restconf/data/ietf-interfaces:interfaces/interface=Loopback0

# OPTIONS — 发现支持的方法
curl -u admin:admin -X OPTIONS \
  https://192.168.1.1/restconf/data/ietf-interfaces:interfaces
```

---

## 4. YANG 数据模型访问

### 4.1 URL 路径映射

YANG 模型层次直接映射为 RESTCONF URL 路径：

```
YANG Path:
  /ietf-interfaces:interfaces/interface[name='Eth1']/description

RESTCONF URL:
  /restconf/data/ietf-interfaces:interfaces/interface=Eth1/description
```

### 4.2 Key-Encoding

YANG list key 使用 `=` 编码在 URL 中：`interface=Eth1` (等价于 `interface[name='Eth1']`)

### 4.3 XML/JSON 双编码

**JSON 响应示例：**
```json
{
  "ietf-interfaces:interfaces": {
    "interface": [{
      "name": "GigabitEthernet0/0/0",
      "type": "iana-if-type:ethernetCsmacd",
      "enabled": true,
      "description": "Uplink to Core"
    }]
  }
}
```

**XML 响应示例：**
```xml
<interfaces xmlns="urn:ietf:params:xml:ns:yang:ietf-interfaces">
  <interface>
    <name>GigabitEthernet0/0/0</name>
    <type xmlns:ianaift="urn:ietf:params:xml:ns:yang:iana-if-type">
      ianaift:ethernetCsmacd
    </type>
    <enabled>true</enabled>
    <description>Uplink to Core</description>
  </interface>
</interfaces>
```

---

## 5. 查询参数与高级功能

### 5.1 标准查询参数

| 参数 | 方法 | 描述 |
|------|:----:|------|
| **content** | GET | `config` (仅配置) / `nonconfig` (仅状态) / `all` (全部) |
| **depth** | GET | 限制返回的子树深度: `1` ~ `65535` 或 `unbounded` |
| **fields** | GET | 只返回指定字段: `fields=name;description;enabled` |
| **filter** | GET | 布尔通知过滤器 (用于事件流) |
| **with-defaults** | GET | `report-all` / `trim` / `explicit` / `report-all-tagged` |
| **insert** | POST/PUT | `first` / `last` / `before` / `after` |
| **point** | POST/PUT | 配合 insert 的插入点值 |

### 5.2 depth 与 fields 使用

```bash
# depth — 只返回接口名 (1层)
curl -u admin:admin -H "Accept: application/yang-data+json" \
  "https://192.168.1.1/restconf/data/ietf-interfaces:interfaces?depth=1"

# fields — 只返回 name 和 description
curl -u admin:admin -H "Accept: application/yang-data+json" \
  "https://192.168.1.1/restconf/data/ietf-interfaces:interfaces?fields=name;description"

# content — 只返回配置数据
curl -u admin:admin -H "Accept: application/yang-data+json" \
  "https://192.168.1.1/restconf/data/ietf-interfaces:interfaces?content=config"
```

---

## 6. YANG Patch (RFC 8072)

### 6.1 概述

YANG Patch 是 RESTCONF 独有的**有序补丁机制**，允许在一个请求中执行多个操作：

```json
{
  "ietf-yang-patch:yang-patch": {
    "patch-id": "patch-1",
    "comment": "Bulk interface update",
    "edit": [
      {"edit-id": "1", "operation": "create",
       "target": "/ietf-interfaces:interfaces/interface=Loopback0",
       "value": {"interface": [{"name": "Loopback0", "type": "iana-if-type:softwareLoopback"}]}},
      {"edit-id": "2", "operation": "merge",
       "target": "/ietf-interfaces:interfaces/interface=GigabitEthernet0/0/0",
       "value": {"interface": [{"description": "Updated via patch"}]}},
      {"edit-id": "3", "operation": "delete",
       "target": "/ietf-interfaces:interfaces/interface=DeprecatedInt"}
    ]
  }
}
```

### 6.2 支持的操作

| 操作 | 描述 |
|------|------|
| **create** | 创建新资源 |
| **delete** | 删除资源 |
| **insert** | 创建 + 指定插入位置 (ordered-by user) |
| **merge** | 合并 (upsert) |
| **move** | 移动资源 (ordered-by user) |
| **remove** | 静默删除 (不存在不报错) |
| **replace** | 完全替换 |

---

## 7. 与 NETCONF / gNMI 对比

| 维度 | **RESTCONF** | **NETCONF** | **gNMI** |
|------|:---:|:---:|:---:|
| **传输** | HTTPS (443) | SSH (830) | gRPC/HTTP2 (57400) |
| **序列化** | JSON/XML | XML | Protobuf |
| **数据模型** | YANG | YANG | OpenConfig YANG |
| **接口风格** | RESTful (CRUD) | RPC (XML messages) | gRPC Stub |
| **数据存储** | running only | running/candidate/startup | running |
| **事务支持** | 无 | ✅ commit/rollback | 无 |
| **YANG Patch** | ✅ RFC 8072 | ❌ | ❌ |
| **流式遥测** | ❌ (polling) | ❌ (polling) | ✅ Subscribe |
| **学习曲线** | ⭐ 低 | ⭐⭐ 中等 | ⭐⭐ 中等 |
| **最佳场景** | Web/DevOps 集成 | 核心网事务配置 | AI 网络流式遥测 |

---

## 8. 实际部署案例

| 案例 | 描述 |
|------|------|
| **Cisco NSO** | 网络服务编排器，RESTCONF 作为北向 API 暴露 YANG 服务模型 |
| **Cisco IOS-XE** | 全系路由器/交换机支持 RESTCONF (IOS-XE 16.3+) |
| **SONiC mgmt-framework** | 开源 Go 实现，YANG → OpenAPI → Go Stub 全自动代码生成 |
| **Curity Identity Server** | 全部管理数据通过 RESTCONF `/admin/api/restconf` 暴露 |
| **华为 CloudEngine** | RESTCONF 支持 JSON/YANG Patch，用于数据中心交换机管理 |
| **Ansible** | RESTCONF 模块 (`restconf_get` / `restconf_config`) 原生集成 |

---

## 9. 2025-2026 最新进展

### 9.1 分页扩展 (IETF 2025 Draft)

| 扩展能力 | URN | 描述 |
|----------|-----|------|
| `:limit` | `...restconf:capability:limit` | 限制返回条目数 |
| `:offset` | `...capability:offset` | 跳过前 N 条 |
| `:cursor` | `...capability:cursor` | 游标分页 |
| `:sort-by` | `...capability:sort-by` | 按指定字段排序 |
| `:where` | `...capability:where` | XPath 条件过滤 |

### 9.2 SONiC mgmt-framework

SONiC 社区的 Go 语言 RESTCONF Server 实现已于 2025 年成熟，具备：
- YANG → OpenAPI 2.0 (Swagger) 自动转换
- Redis-backed 配置和状态存储
- 与 gNMI 路径翻译互通
- 完整的 RFC 8040 合规性

---

## 10. 开发实践: Java REST API

### 10.1 Java HttpClient 实现

```java
import java.net.http.*;
import java.net.URI;
import java.util.Base64;

public class RestconfClient {

    private final HttpClient client;
    private final String baseUrl;
    private final String authHeader;

    public RestconfClient(String host, int port, String user, String pass) {
        this.client = HttpClient.newBuilder()
            .sslContext(/* trust all for lab */ null)
            .build();
        this.baseUrl = "https://" + host + ":" + port + "/restconf";
        this.authHeader = "Basic " + Base64.getEncoder()
            .encodeToString((user + ":" + pass).getBytes());
    }

    // GET — 读取资源
    public String get(String yangPath) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/data/" + yangPath))
            .header("Authorization", authHeader)
            .header("Accept", "application/yang-data+json")
            .GET().build();
        return client.send(req, HttpResponse.BodyHandlers.ofString()).body();
    }

    // POST — 创建资源 / 调用 RPC
    public String post(String yangPath, String jsonBody) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/data/" + yangPath))
            .header("Authorization", authHeader)
            .header("Content-Type", "application/yang-data+json")
            .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
            .build();
        return client.send(req, HttpResponse.BodyHandlers.ofString()).body();
    }

    // PUT — 创建或替换资源
    public String put(String yangPath, String jsonBody) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/data/" + yangPath))
            .header("Authorization", authHeader)
            .header("Content-Type", "application/yang-data+json")
            .PUT(HttpRequest.BodyPublishers.ofString(jsonBody))
            .build();
        return client.send(req, HttpResponse.BodyHandlers.ofString()).body();
    }

    // PATCH — 部分更新
    public String patch(String yangPath, String jsonBody) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/data/" + yangPath))
            .header("Authorization", authHeader)
            .header("Content-Type", "application/yang-data+json")
            .method("PATCH", HttpRequest.BodyPublishers.ofString(jsonBody))
            .build();
        return client.send(req, HttpResponse.BodyHandlers.ofString()).body();
    }

    // DELETE — 删除资源
    public String delete(String yangPath) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/data/" + yangPath))
            .header("Authorization", authHeader)
            .DELETE().build();
        return client.send(req, HttpResponse.BodyHandlers.ofString()).body();
    }

    // OPTIONS — 发现支持的方法
    public String options(String yangPath) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/data/" + yangPath))
            .header("Authorization", authHeader)
            .method("OPTIONS", HttpRequest.BodyPublishers.noBody())
            .build();
        return client.send(req, HttpResponse.BodyHandlers.ofString())
            .headers().firstValue("Allow").orElse("unknown");
    }

    // YANG Patch — 批量编辑
    public String yangPatch(String yangPath, String patchJson) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/data/" + yangPath))
            .header("Authorization", authHeader)
            .header("Content-Type", "application/yang-patch+json")
            .method("PATCH", HttpRequest.BodyPublishers.ofString(patchJson))
            .build();
        return client.send(req, HttpResponse.BodyHandlers.ofString()).body();
    }

    // 服务发现
    public String discover() throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl.replace("/restconf", "/.well-known/host-meta")))
            .header("Authorization", authHeader)
            .GET().build();
        return client.send(req, HttpResponse.BodyHandlers.ofString()).body();
    }

    // 完整接口配置示例
    public static void main(String[] args) throws Exception {
        RestconfClient rc = new RestconfClient("192.168.1.1", 443, "admin", "admin");

        // 读取所有接口
        System.out.println(rc.get("ietf-interfaces:interfaces"));

        // 创建 Loopback 接口
        String newIface = """
            {"interface": [{
              "name": "Loopback0",
              "type": "iana-if-type:softwareLoopback",
              "enabled": true
            }]}""";
        System.out.println(rc.post("ietf-interfaces:interfaces", newIface));

        // 更新描述
        String update = """
            {"interface": [{"description": "Management Loopback"}]}""";
        System.out.println(rc.patch(
            "ietf-interfaces:interfaces/interface=Loopback0", update));

        // YANG Patch — 批量操作
        String patch = """
            {"ietf-yang-patch:yang-patch": {
              "patch-id": "batch-1",
              "edit": [
                {"edit-id": "1", "operation": "create",
                 "target": "/ietf-interfaces:interfaces/interface=Loopback1",
                 "value": {"interface": [{"name": "Loopback1",
                   "type": "iana-if-type:softwareLoopback", "enabled": true}]}},
                {"edit-id": "2", "operation": "merge",
                 "target": "/ietf-interfaces:interfaces/interface=Loopback0",
                 "value": {"interface": [{"description": "Updated via YANG Patch"}]}}
              ]}}""";
        System.out.println(rc.yangPatch("ietf-interfaces:interfaces", patch));
    }
}
```

> **依赖:** JDK 11+ (内置 `java.net.http` 和 `javax.net.ssl`)，无需第三方库。

---

## 11. 总结与展望

### 11.1 核心优势

1. **Web 原生:** HTTP/HTTPS + JSON，curl/Postman 即可调试
2. **双编码:** JSON + XML，自动协商 (Accept/Content-Type)
3. **YANG Patch:** 有序批量操作，解决 RESTful 单次请求只能操作一个资源的限制
4. **模型发现:** `/.well-known/host-meta` + YANG Library 自动发现
5. **生态丰富:** Ansible、Terraform、Cisco NSO、SONiC 原生支持

### 11.2 核心局限

1. **无事务:** 变更立即生效，无 NETCONF 的 candidate + commit 机制
2. **无推送遥测:** 仅 polling，不如 gNMI Subscribe
3. **仅 running 存储:** 无法操作 startup/candidate 数据存储
4. **无锁机制:** 并发写入无保护

### 11.3 在五大协议中的定位

| 协议 | 定位 |
|------|------|
| **RESTCONF** | Web DevOps 配置 CRUD |
| **NETCONF** | 事务性核心网配置 |
| **gNMI** | 流式遥测 + 亚秒级监控 |
| **SNMP** | 遗留设备全覆盖 |
| **OpenWiFi** | 无线 SDN 架构 |

---

## 12. 参考资源

| 资源 | URL |
|------|-----|
| RFC 8040 (RESTCONF) | https://datatracker.ietf.org/doc/rfc8040/ |
| RFC 8072 (YANG Patch) | https://datatracker.ietf.org/doc/rfc8072/ |
| RFC 8525 (YANG Library) | https://datatracker.ietf.org/doc/rfc8525/ |
| Cisco RESTCONF Guide | https://developer.cisco.com/docs/yangsuite/restconf-in-yang-suite/ |
| SONiC mgmt-framework | https://github.com/sonic-net/sonic-mgmt-framework |
| FS.com RESTCONF Glossary | https://www.fs.com/glossary/restconf-30.html |

---

> **声明:** 本文档基于公开资料整理，仅供 SDN 技术研究参考。所有商标归各自所有者拥有。
