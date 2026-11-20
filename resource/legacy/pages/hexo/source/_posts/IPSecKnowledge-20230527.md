---
title: IPSec 技术的理解
cover_image: 
cover_image_alt: 
date: 2023-05-27 18:02:27
tags:
    - 安全
    - 网络
    - 中文
categories:
    - 技术
---

> 本文首发于个人博客 \
> 发表日期：2023.5.27

目前家里两个地方都有公网环境，为了保证安全性与防止备案问题（也就是不想给外部用户提供任何服务），所以利用华硕路由器都配置了IPSec VPN。这两天想看看他的安全性问题，所以看了看IPSec技术的原理。

# 主流IPSec VPN配置

看了看目前比较主流的配置大致就两种：

- L2TP / IPSec
- Cisco IPSec (IPSec / IKE)

华硕路由器原生支持的是后者，在MacOS上则是两种都支持。

# IPSec 技术

先看IPSec技术本身，其工作在第三层即网络层上，需要开放UDP500和4500端口。报文大致含有以下内容：

- 认证头AH，维基上给出的结构如下（懒了直接把维基html抄下来了）：

<table class="wikitable" style="margin:1em auto; text-align: center">
<caption style="background:#781549; color:white;"><i>Authentication Header</i> format
</caption>
<tbody><tr>
<th style="border-bottom:none; border-right:none;"><i>Offsets</i>
</th>
<th style="border-left:none;">Octet<sub>16</sub>
</th>
<th colspan="8">0
</th>
<th colspan="8">1
</th>
<th colspan="8">2
</th>
<th colspan="8">3
</th></tr>
<tr>
<th style="border-top: none">Octet<sub>16</sub>
</th>
<th>Bit<sub>10</sub>
</th>
<th style="width:2.6%;">0
</th>
<th style="width:2.6%;">1
</th>
<th style="width:2.6%;">2
</th>
<th style="width:2.6%;">3
</th>
<th style="width:2.6%;">4
</th>
<th style="width:2.6%;">5
</th>
<th style="width:2.6%;">6
</th>
<th style="width:2.6%;">7
</th>
<th style="width:2.6%;">8
</th>
<th style="width:2.6%;">9
</th>
<th style="width:2.6%;">10
</th>
<th style="width:2.6%;">11
</th>
<th style="width:2.6%;">12
</th>
<th style="width:2.6%;">13
</th>
<th style="width:2.6%;">14
</th>
<th style="width:2.6%;">15
</th>
<th style="width:2.6%;">16
</th>
<th style="width:2.6%;">17
</th>
<th style="width:2.6%;">18
</th>
<th style="width:2.6%;">19
</th>
<th style="width:2.6%;">20
</th>
<th style="width:2.6%;">21
</th>
<th style="width:2.6%;">22
</th>
<th style="width:2.6%;">23
</th>
<th style="width:2.6%;">24
</th>
<th style="width:2.6%;">25
</th>
<th style="width:2.6%;">26
</th>
<th style="width:2.6%;">27
</th>
<th style="width:2.6%;">28
</th>
<th style="width:2.6%;">29
</th>
<th style="width:2.6%;">30
</th>
<th style="width:2.6%;">31
</th></tr>
<tr>
<th>0
</th>
<th>0
</th>
<td colspan="8"><i>Next Header</i>
</td>
<td colspan="8"><i>Payload Len</i>
</td>
<td colspan="16"><i>Reserved</i>
</td></tr>
<tr>
<th>4
</th>
<th>32
</th>
<td colspan="32"><i>Security Parameters Index (SPI)</i>
</td></tr>
<tr>
<th>8
</th>
<th>64
</th>
<td colspan="32"><i>Sequence Number</i>
</td></tr>
<tr>
<th>C
</th>
<th>96
</th>
<td colspan="32" rowspan="2"><i>Integrity Check Value (ICV)</i><br>...
</td></tr>
<tr>
<th>...
</th>
<th>...
</th></tr></tbody></table>

- 加密过的报文ESP，同样可以看一下结构：

<table class="wikitable" style="margin:1em auto; text-align: center">
<caption style="background:#781549; color:white;"><i>Encapsulating Security Payload</i> format
</caption>
<tbody><tr>
<th style="border-bottom:none; border-right:none;"><i>Offsets</i>
</th>
<th style="border-left:none;">Octet<sub>16</sub>
</th>
<th colspan="8">0
</th>
<th colspan="8">1
</th>
<th colspan="8">2
</th>
<th colspan="8">3
</th></tr>
<tr>
<th style="border-top: none">Octet<sub>16</sub>
</th>
<th>Bit<sub>10</sub>
</th>
<th style="width:2.6%;">0
</th>
<th style="width:2.6%;">1
</th>
<th style="width:2.6%;">2
</th>
<th style="width:2.6%;">3
</th>
<th style="width:2.6%;">4
</th>
<th style="width:2.6%;">5
</th>
<th style="width:2.6%;">6
</th>
<th style="width:2.6%;">7
</th>
<th style="width:2.6%;">8
</th>
<th style="width:2.6%;">9
</th>
<th style="width:2.6%;">10
</th>
<th style="width:2.6%;">11
</th>
<th style="width:2.6%;">12
</th>
<th style="width:2.6%;">13
</th>
<th style="width:2.6%;">14
</th>
<th style="width:2.6%;">15
</th>
<th style="width:2.6%;">16
</th>
<th style="width:2.6%;">17
</th>
<th style="width:2.6%;">18
</th>
<th style="width:2.6%;">19
</th>
<th style="width:2.6%;">20
</th>
<th style="width:2.6%;">21
</th>
<th style="width:2.6%;">22
</th>
<th style="width:2.6%;">23
</th>
<th style="width:2.6%;">24
</th>
<th style="width:2.6%;">25
</th>
<th style="width:2.6%;">26
</th>
<th style="width:2.6%;">27
</th>
<th style="width:2.6%;">28
</th>
<th style="width:2.6%;">29
</th>
<th style="width:2.6%;">30
</th>
<th style="width:2.6%;">31
</th></tr>
<tr>
<th>0
</th>
<th>0
</th>
<td colspan="32"><i>Security Parameters Index (SPI)</i>
</td></tr>
<tr>
<th>4
</th>
<th>32
</th>
<td colspan="32"><i>Sequence Number</i>
</td></tr>
<tr>
<th>8
</th>
<th>64
</th>
<td colspan="32" rowspan="2"><i>Payload data</i>
</td></tr>
<tr>
<th>...
</th>
<th>...
</th></tr>
<tr>
<th>...
</th>
<th>...
</th>
<td colspan="8" style="border-top-style: hidden;">&nbsp;
</td>
<td colspan="24" style="border-bottom-style: hidden;">&nbsp;
</td></tr>
<tr>
<th>...
</th>
<th>...
</th>
<td colspan="8" style="border-right-style: hidden;">&nbsp;
</td>
<td colspan="16"><i>Padding (0-255 octets)</i>
</td>
<td colspan="8" style="border-left-style: hidden;">&nbsp;
</td></tr>
<tr>
<th>...
</th>
<th>...
</th>
<td colspan="16" style="border-top-style: hidden;">&nbsp;
</td>
<td colspan="8"><i>Pad Length</i>
</td>
<td colspan="8"><i>Next Header</i>
</td></tr>
<tr>
<th>...
</th>
<th>...
</th>
<td colspan="32" rowspan="2"><i>Integrity Check Value (ICV)</i><br>...
</td></tr>
<tr>
<th>...
</th>
<th>...
</th></tr></tbody></table>

当然根据具体协议封装方式不同其结构也有所不同，但基本上都会含有上面的部分。从上面也可以看出，IPSec包含了这些协议：AH、ESP和ISAKMP。

IPSec通常有两种传输模式，即隧道模式和传输模式。工作方式见名知意。

![picture](picture-1.svg.png)

## L2TP / IPSec

L2TP工作在第二层数据链路层，使用端口UDP1701。某种意义上可以理解成是把PPP载荷包了一层UDP。由于IPSec更多侧重于对数据报文的加密也就是安全性，在用户认证上比较薄弱。因而常会考虑将L2TP和IPSec结合。

仔细想一下，当家里路由器桥接光猫，路由器拨号的时候，光猫只作Modem，路由器通过PPPoE方式拨号，这里PPPoE实质上就是封装了PPP协议。大概是由于PPP擅于进行身份认证和IP分配，所以大量采用PPPoE方式来接入宽带。

总之由于L2TP可以很方便地做多用户的认证，可以很好地解决IPSec在这方面的缺陷，所以两者经常被组合使用。

## Cisco IPSec (IPSec / IKE)

Cisco的IPSec大体上是结合使用了IKE协议，当然也有在此之上再利用L2TP协议的，不过华硕和MacOS似乎都没有支持？因而这里不作探讨。

先说IKE协议，全程即网络密钥交换协议，基本上是用下列方式进行身份认证和密钥分发的：

- 身份认证，支持PSK、RSA、数字信封
- 身份保护，利用DH密钥交换算法和PFS

IKEv1和v2最大不同在于v2简化了协商过程并修复了些安全漏洞。

![picture](picture-2.png)

基本的认证过程如上图。

现在考虑IPSec和IKE组合使用的情景，也就是大部分的实际情景：

![picture](picture-3.png)

注意这里IPSec进行加密和认证的时候支持MD5和SHA-1，在IKE认证部分则是利用了FPS和PSK或RSA（这里是提供给配置者自选的）。

可以再结合Cisco官网的图片和解释看一下：

![picture](picture-4.jpg.avif)

![picture](picture-5.jpg.avif)

![picture](picture-6.jpg.avif)

# 结论

个人来看对个人用户而言这种安全性是足够了的。嫌证书认证麻烦不用RSA而选择PSK都已经足够。其实华硕本身也提供了证书可以使用，不过由于家宽一般都是动态公网IP每次IP变了都要重新弄成本也确实相对高一点。

# 参考资料

1. IPsec and IKE. (2023, April 5). IPsec and IKE. https://sc1.checkpoint.com/documents/R81/WebAdminGuides/EN/CP_R81_SitetoSiteVPN_AdminGuide/Topics-VPNSG/IPsec-and-IKE.htm
2. Introduction to Cisco IPsec Technology. (2007, August 3). Cisco. https://www.cisco.com/c/en/us/td/docs/net_mgmt/vpn_solutions_center/2-0/ip_security/provisioning/guide/IPsecPG1.html
3. IPsec - Wikipedia. (2014, February 18). IPsec - Wikipedia. https://en.wikipedia.org/wiki/IPsec#
4. IPSec IKEv1&IKEv2_ike sa是双向的吗_text1.txt的博客-CSDN博客. (2001, November 14). IPSec IKEv1&IKEv2_Ike sa是双向的吗_text1.txt的博客-CSDN博客. https://blog.csdn.net/weixin_51045259/article/details/113639007?utm_medium=distribute.pc_relevant.none-task-blog-2~default~baidujs_baidulandingword~default-5-113639007-blog-123870000.235^v36^pc_relevant_default_base3&spm=1001.2101.3001.4242.4&utm_relevant_index=8
5. HCIE-Security Day33：IPSec：深入学习ipsec ikev2、IKEV1和IKEV2比较_ike v1与ike v2的区别_小梁L同学的博客-CSDN博客. (2001, May 12). HCIE-Security Day33：IPSec：深入学习ipsec Ikev2、IKEV1和IKEV2比较_Ike V1与ike V2的区别_小梁L同学的博客-CSDN博客. https://blog.csdn.net/qq_36813857/article/details/123870000
6. Basic Concepts of IPSec - S600-E V200R011C10 Configuration Guide - VPN - Huawei. (2021, October 20). Basic Concepts of IPSec - S600-E V200R011C10 Configuration Guide - VPN - Huawei. https://support.huawei.com/enterprise/en/doc/EDOC1000178025/ae03ecd3/basic-concepts-of-ipsec
7. 既然IPsec有隧道模式，为什么还有L2TP+IPsec这样的组合？ - 知乎. (2018, June 15). 既然IPsec有隧道模式，为什么还有L2TP+IPsec这样的组合？ - 知乎. https://www.zhihu.com/question/279686051
