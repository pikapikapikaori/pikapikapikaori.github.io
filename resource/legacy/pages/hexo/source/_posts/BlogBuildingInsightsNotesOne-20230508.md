---
title: 个人博客搭建心得（壹）：以CSS 3为代表的一些前端开发感悟
cover_image: 
cover_image_alt: 
date: 2023-05-08 22:20:43
tags:
    - 开发
    - 中文
categories:
    - 技术
---

> 本文首发于个人博客 \
> 发表日期：2023.5.8

# 前期考虑

最近搭个人博客，最终选择了利用Docsify这个框架，主要原因有这么几点；

## 经济成本

尽管家里有两台有公网的服务器，但考虑到备案的时间长短、以及一些其他的隐性成本，因而使用家里服务器甚至于国内可购买的服务器都不是一个很好的选择。相应的，如果在国外购买服务器一是支付方式不便捷，二来需要较高的成本。

相较之下由于我的个人博客不会有超大量的文章以及评论等，因而可以直接部署的静态网页成了一个相当好的选择。以GitHub Pages和Vercel为代表的一众平台都给个人用户提供了较多的资源用于前端搭建，使得搭建博客的成本可以大大降低。同时，这些平台都支持https协议，并且生成的域名也不是很难看。即使实在不喜欢也可以很容易的自己购买域名进行配置，非常简便。

## 开发成本

由于我更希望我的博客注重于转写文章本身而非锻炼开发能力之类的，因而使用现成的博客框架是第一考虑。

看了很久博客框架发现Docsify算是一个比较轻量级的框架。首先Docsify本身的快速搭建是极方便的，宣扬的十分钟还是半小时搭一个简单网页确实不是吹的。更重要的是，动态渲染这一特性不像Hexo为代表的其他框架一样需要编译甚至部署后才能查看，相反本地起个server就能即使看到效果，这对博客定制化开发与博客内容的撰写都是相当方便的一大特性。由动态渲染这一特性延伸出来的便是二次开发的高度灵活性。借用Docsify自身提供的几个钩子，甚至不用也行，可以直接以UMD方式挂在其他前端轮子，或者自己写好css和js后直接挂载进来，而无需其他的一系列操作。相较之下Hexo、Vuepress为代表的其他框架可能开发上就相对死板一些，不是很符合我个人喜好。

## Docsify总结

总体来看Docsify现成轮子会相对少一点，不过这些东西可以自己随便写写玩反倒更灵活自由，不过动态渲染这一点使得撰写与开发都相当便捷这是我很喜欢的一点。当然SEO可能会相对差一点，不过这一点一来可以考虑利用v4提供的SSR来解决，相反即使不解决我都部署在GitHub Pages上了我显然是不需要也不想要做这个的。

总之再用上这么个框架后，为了满足自己喜好加点自己想要的花里胡哨的界面啊功能啊之类的东西，最近写了不少原生的html 5 + css 3 + js代码，确实是有不少感悟。

# CSS

感悟最深的大概就是css的使用了。说实话一直以来我其实在服务端做的东西比较多，前端基本上就是用用组件库应付应付课设，也不会特别关注美观度啊动画啊之类的东西。写博客为了想要点好看的东西不得不好好看看css写法，发现原来css还能玩的这么花里胡哨。比如在我博客的[随笔下的短评部分](/writings/BriefComments)，我想要以年为单位记录短评，每个年份类似一个details标签的行为，但是默认的details标签样式实在太丑了，我也不想为了这么个简单的小功能写一大段js挂在到`index.html`，看了看stackoverflow上发现可以用伪元素来写：

当然这里用了`@media`来做响应式，这也是以前很少考虑的一点。一方面基本上不会怎么去做不同分辨率屏幕的适配，一方面就算做基本上也就是用个ElementUI的布局就算完事了。现在想想感觉其实是有点太依赖组件库了，不是一个很好的事。最近想试试用Swift写Web后端的时候第一反应也是看看Vapor怎么用，感觉确实是有点太思维定势了：后端用框架、前端用框架加组件库。工程上说挺合理的，节约成本。不过自己开发的时候一来是高度定制化的需求很难满足，二来确实会少很多乐趣。

<p>
    <iframe width="100%" height="300px" src="//jsfiddle.net/pikapikapi/b9Lu37v6/embedded/html,css,result/" allowfullscreen="allowfullscreen" allowpaymentrequest frameborder="0" style="border-radius: 7px"></iframe>
</p>

说回css，这个伪元素确实是个很好用的东西。同样是这个界面，我想在标题之间加个分割线，希望这个分割线是中间有个小星星，然后左右有两条短线；而在短评内部最下方日期上希望有个动态的吃豆人分割线。同样是利用了伪元素就可以很简单的实现：

这里`animation`和`@keyframe`也是css 3新特性，可以很方便的去做动画效果。

<p>
    <iframe width="100%" height="300px" src="//jsfiddle.net/pikapikapi/pyb42tus/10/embedded/html,css,result/" allowfullscreen="allowfullscreen" allowpaymentrequest frameborder="0" style="border-radius: 7px"></iframe>
</p>

当然也可以利用`transform`这个新特性来做动画效果。这个博客上右侧的小组件显示隐藏逻辑就是这么做的：

<p>
    <iframe width="100%" height="300px" src="//jsfiddle.net/pikapikapi/ft3kares/28/embedded/" allowfullscreen="allowfullscreen" allowpaymentrequest frameborder="0" style="border-radius: 7px"></iframe>
</p>

# js

另外js上碰到的最大的麻烦是想做个查看大图的功能，看了看stackoverflow上比较高的做法是做一个宽`100vw`高`100vh`的整体span，点击图片把span的`display`设成`block`，再点span设成`none`，不过那个版本太粗糙还有很多问题，比如我要放按钮的话子元素点击也会触发父元素的。今天重构了一下大概变成现在的样子：

思路还是用span遮盖，同时设置`z-index`防其他事件的影响，在span里面放div来包裹组件，同时span的点击事件先去根据事件的`target.id`来判断触发者，从而来确保子元素点击事件不会总是触发父元素的点击事件。

js逻辑里拿元素根据类名做filter的步骤感觉可以用`querySelectorAll`来简化一下。

另外也用`backdrop-filter`和`-webkit-backdrop-filter`做了个毛玻璃的背景效果，更好看些。

<p>
    <iframe width="100%" height="300" src="//jsfiddle.net/pikapikapi/fkt849L2/15/embedded/" allowfullscreen="allowfullscreen" allowpaymentrequest frameborder="0" style="border-radius: 7px"></iframe>
</p>

# 参考资料

1. How to position marker to come after. (2019, June 25). Stack Overflow. https://stackoverflow.com/questions/56758098/how-to-position-detail-marker-to-come-after-summary
2. How do I make an image full screen on click? (2021, June 3). Stack Overflow. https://stackoverflow.com/questions/67815853/how-do-i-make-an-image-full-screen-on-click
