h5pal
=====

# Introduction

&lt;The Legend of Sword and Fairy> I.E. PAL [(wikipedia)](http://en.wikipedia.org/wiki/The_Legend_of_Sword_and_Fairy) porting to HTML5. Based on [SDLPAL](http://sdlpal.codeplex.com).

《仙剑奇侠传》[(百度百科)](http://baike.baidu.com/view/2188.htm#sub5215543)的HTML5 移植，基于[SDLPAL](http://sdlpal.codeplex.com)。

# How to play

## 环境

* [Node.js](http://nodejs.org/)
* [gulp](http://gulpjs.com/)
* [bower](http://bower.io/)

## build

* `bower install`
* `npm install`
* `gulp`
* 建立`pal-assets/`目录，把仙剑95版（存档180~185KB的版本）的所有文件拷贝进去。（不要问我去哪里找）

## 运行

* `gulp serve`
* 在`chrome://flags`里打开_“启用实验性JavaScript”_
* 打开[http://localhost:8005/h5pal.html](http://localhost:8005/h5pal.html)
* Enjoy

# 其他

## 完成度

| 模块 | 进度 |
| --- | ---:|
| 资源 | 90% |
| 位图 | 99% |
| Sprite | 99% |
| 地图 | 90% |
| 调色盘 | 80% |
| 文本 | 99% |
| 脚本（天坑） | 50% |
| 平常UI | 50% |
| 战斗UI | 0% |
| 战斗（天坑） | 0% |
| 音乐 | 0% |
| 音效 | 0% |

~~以上数值除了为0的外都是盲目乐观的~~

## 已知问题

[Issues](https://github.com/LiuJi-Jim/h5pal/issues)太多了，懒得列，慢慢补。

## 开发者须知

* ES6 and [babel](http://babeljs.io/)
* ES6 [generator/yield](http://jimliu.net/2014/11/28/a-brief-look-at-es6-generator-function/) and [co](https://github.com/tj/co)

## Inspired by [SDLPAL](http://sdlpal.codeplex.com)

-----
仙剑20岁生日快乐