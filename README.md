h5pal
=====

# Introduction

《仙剑奇侠传》[(百度百科)](http://baike.baidu.com/view/2188.htm#sub5215543)的HTML5 移植，基于[SDLPAL](http://sdlpal.codeplex.com)。

&lt;The Legend of Sword and Fairy> I.E. PAL [(wikipedia)](http://en.wikipedia.org/wiki/The_Legend_of_Sword_and_Fairy) porting to HTML5. Based on [SDLPAL](http://sdlpal.codeplex.com).

[English version of this README](#ENG)

# 如何搞起

## 环境

* [Node.js](http://nodejs.org/)
* [gulp](http://gulpjs.com/)
* [bower](http://bower.io/)

## 构建

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

## 一句话，我TM就想知道能玩吗？

能走，能对话，能开宝箱，能用道具……能做很多事情，排除BUG造成剧情无法进行下去以外，只靠走地图可以体验很多很多剧情……了。

等等，没实现战斗系统？那遇敌了怎么办？`return true;`啊233！

## 没图你说个JB

[Screenshots](http://liuji-jim.github.io/h5pal/screenshots.html)

## 完成度

| 模块 | 进度 |
| --- | ---:|
| 资源 | 90% |
| 读档 | 99% |
| 存档 | 0% |
| Surface | 85% |
| 位图 | 99% |
| Sprite | 99% |
| 地图 | 90% |
| 场景 | 90% |
| 调色盘 | 80% |
| 文本 | 99% |
| 脚本（天坑） | 50% |
| 平常UI | 50% |
| 战斗UI | 0% |
| 战斗（天坑） | 0% |
| 视频 | 0% |
| 音乐 | 0% |
| 音效 | 0% |

~~以上数值除了为0的外都是盲目乐观的~~

## 已知问题

[Issues](https://github.com/LiuJi-Jim/h5pal/issues)太多了，懒得列，慢慢补。

## 开发者须知

* ES6 and [babel](http://babeljs.io/)
* ES6 [generator/yield](http://jimliu.net/2014/11/28/a-brief-look-at-es6-generator-function/) and [co](https://github.com/tj/co)

## Inspired by [SDLPAL](http://sdlpal.codeplex.com)

## 结语

仙剑20岁生日快乐

----

# <a name="ENG"></a>How to play

## Environment

* [Node.js](http://nodejs.org/)
* [gulp](http://gulpjs.com/)
* [bower](http://bower.io/)

## Build

* `bower install`
* `npm install`
* `gulp`
* Create a folder named `pal-assets`. Copy all pal95 (which one save file is 180~185KB) files into it. (You may not find these files in this repo due to copyright reasons.)

## Run

* `gulp serve`
* Turn on _"Enable experimental JavaScript"_ in `chrome://flags`
* Open [http://localhost:8005/h5pal.html](http://localhost:8005/h5pal.html) 
* Enjoy

# Etc.

## I'm just wondering whether I can play it or not.

You can walk, talk, open chests, use items ... a lot of thing in this game. Without some bugs crashing the game, you can experience the story well.

Eh wait, no battle system? What about encounters? `return true;` LoL.

## STFU without pictures

[Screenshots](http://liuji-jim.github.io/h5pal/screenshots.html)

## Progress

| Module | Progress |
| --- | ---:|
| Resource | 90% |
| Loading | 99% |
| Saving | 0% |
| Surface | 85% |
| Bitmap | 99% |
| Sprite | 99% |
| Map | 90% |
| Scene | 90% |
| Palette | 80% |
| Text | 99% |
| Script (OMG) | 50% |
| Game UI | 50% |
| Battle UI | 0% |
| Battle (OMG) | 0% |
| Video | 0% |
| Music | 0% |
| Sound | 0% |

~~Numbers above are all given at will except zeros.~~

## Known Issues

[Issues](https://github.com/LiuJi-Jim/h5pal/issues) - tooooo many. Will fill this later.

## Developers should know first

* ES6 and [babel](http://babeljs.io/)
* ES6 [generator/yield](http://jimliu.net/2014/11/28/a-brief-look-at-es6-generator-function/) and [co](https://github.com/tj/co)

## Inspired by [SDLPAL](http://sdlpal.codeplex.com)

## Ending

Happy 20th birthday to pal.