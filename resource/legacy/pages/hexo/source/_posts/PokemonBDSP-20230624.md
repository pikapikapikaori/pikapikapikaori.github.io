---
title: 宝可梦晶灿钻石／明亮珍珠与宝可梦Home联动相关
cover_image: 
cover_image_alt: cover
date: 2023-06-24 14:27:41
tags:
    - 游戏
    - 中文
categories:
    - 随想
---

> 本文首发于个人博客\
> 发表日期：2023.06.24

# bdsp传输限制

由于晶灿钻石／明亮珍珠（下称bdsp）1.1版本的复制bug，在之后ILCA开放与Home联动时对特定宝可梦的传输做出了一定的限制。

对于此，[神奇宝贝](https://wiki.52poke.com/wiki/Pokémon_HOME)百科上的记述如下：

> 在正常游戏流程中仅可获得1只的宝可梦，从同一个游戏记录中最多仅可寄放1只到Pokémon HOME。例如，从《晶灿钻石／明亮珍珠》将帝牙卢卡寄放到Pokémon HOME后，无法再次从该游戏记录将帝牙卢卡寄放到同一个Pokémon HOME账号。\
> 部分通过游戏漏洞或修改获得的宝可梦无法寄放到Pokémon HOME。\
> 因为程序漏洞问题，既不能寄放晃晃斑也不能将其领取到《晶灿钻石／明亮珍珠》；只有来自《晶灿钻石／明亮珍珠》的土居忍士可以领取到《晶灿钻石／明亮珍珠》。\
> 不能领取超极巨化的皮卡丘、喵喵及伊布到《晶灿钻石／明亮珍珠》。

[时拉比](https://www.serebii.net/pokemonhome/transfer.shtml)上的记述则是：

> Pokémon Brilliant Diamond & Shining Pearl have an extra limitation where you can only put 1 of each species of Special Pokémon (Legendary, Mythical) into Pokémon HOME from each save file.\
> Blocked Pokémon:\
> Pikachu, Eevee and Meowth with the Gigantamax Factor can't be placed in the game\
> Nincada can't be placed in the game unless it came from Brilliant Diamond & Shining Pearl\
> Spinda can't be added in the game or removed from the game If a Pokémon gets Hyper Trained in Scarlet & Violet and isn't Level 100, it cannot be added back until it is Level 100

当然，问题在于这两个相对权威的百科网站对实际上的传送规则并没有更详细的说明。故而，笔者为此做了一些测试。实际上来说，从bdsp向home端的传送对神幻兽的限制并不如百科上字面理解的那样严格。事实上，这一限制（即同种神幻兽只能从存档中向home转移一只）仅对来自bdsp同一版本（bd/sp）的神幻兽起作用。另一方面，在遵循上述限制的前提下，同一个bdsp的存档可以向home传输的来源地标记为bdsp神奥地区的神幻兽宝可梦，其最多可以传输一只通常颜色的神幻兽宝可梦，以及一只异色（闪光）该种神幻兽宝可梦，即共计两只。从目前的表现反推，考虑是从Home的追踪码结合来源标记系统作出的限制。

下面以几个例子详述：

1. 假如有来自bdsp神奥地区（来源标记为下图）的帝牙卢卡A，以及来自其他地区（无来源标记的g3、g4、g5，或者不为先前提到的来源标记的地区，包含旧神奥）的帝牙卢卡B，那么帝牙卢卡A和B可以同时从bdsp取放到home。
2. 假如有来自其他地区（来源标记不为下图）的帝牙卢卡A和帝牙卢卡B，那么帝牙卢卡A和B可以同时从bdsp取放到home。
3. 假如有帝牙卢卡A和帝牙卢卡B，两者都有来源标记为下图，其中帝牙卢卡A出生于bd，帝牙卢卡B出生于sp，那么将帝牙卢卡A由bd经过home取放到sp后，帝牙卢卡A和帝牙卢卡B可以同时从bdsp取放到home。
4. 假如有帝牙卢卡A和帝牙卢卡B，两者都有来源标记为下图，其中帝牙卢卡A出生于bd，帝牙卢卡B出生于sp，将帝牙卢卡B经过连接交换直接从sp传输到bd后（即未经过home），那么帝牙卢卡A和帝牙卢卡B至多只能有一只可以从bdsp取放到home。
5. 同样的，假如有帝牙卢卡A和帝牙卢卡B，两者都有来源标记为下图且都出生于bd，那么帝牙卢卡A和帝牙卢卡B至多只能有一只可以同时从bdsp取放到home。

![symbol](Sinnoh_symbol.png)

# 规避传输限制的方法

当然，有限制就有解决方法。实质上来说，最关键的预防方式是尽可能不要将来源标记为下图的神幻兽放到同一个bdsp的游戏存档中。然而，假如已经不幸发生了这样的情况，解决方法也不是没有。

事实上，可以参考上述例子的第4条，可以考虑将多余的来源标记为下图的神幻兽通过连接交换（而非home），直接传输到一个新的游戏存档中，再利用home从这个新的存档中将这只神幻兽取出。尽管成本较高，但这也是目前唯一可以对这一类神幻兽存取的方法了。

# 附录

![legend & maboroshi](picture-1.png)

> 神奇宝贝百科罗列出的特殊的宝可梦。其中，“传说中的宝可梦”和“幻之宝可梦”两个类别的宝可梦都会受到bdsp的上述传输限制。这一限制也包括了可由宝可梦培育从蛋中孵化的霏欧纳
