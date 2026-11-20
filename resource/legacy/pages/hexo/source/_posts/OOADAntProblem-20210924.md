---
title: 生成n位全部二进制数，数组形式：蚂蚁爬杆问题
cover_image: 
cover_image_alt: 
date: 2021-09-24 13:56:27
mathjax: true
tags:
    - 开发
    - 中文
categories:
    - 技术
---

> 本文首发于[CSDN](https://blog.csdn.net/weixin_42553007/article/details/120447886?spm=1001.2014.3001.5502) \
> 发表日期：2021.9.24

OOAD第一次项目，以OOAD思想实现蚂蚁爬杆问题解法。

# 问题

先重述一下蚂蚁爬杆问题：

> 有一根300 厘米的细木杆，在第30厘米、80厘米、110厘米、160厘米、250厘米这五个位置上各有一只蚂蚁。木杆很细，不能同时通过两只蚂蚁。 \
> 开始时，蚂蚁的头朝左还是朝右是任意的，它们只会朝前走或调头，但不会后退。 当任意两只蚂蚁碰头时，两只蚂蚁会同时调头朝相反方向走。假设蚂蚁们每秒钟可以走5厘米的距离。 \
> **注：不允许穿越对方身体继续直行。** \
> 请编写一个程序，计算各种可能情形下所有蚂蚁都离开木杆的最小时间和最大时间。

# 思路

在编写过程中设置了一个`GameRoom`类用于模拟运行全部蚂蚁的爬行情况，其中需要一个函数来生成所有可能的方向组合。

我在写几个类的头文件最开始定义了一个游戏数据结构体，用于存放每一种方向组合的具体蚂蚁初试方向与游戏的结束时间：

```cpp
struct GameData
{
    bool antDirection[DefaultAnt.antcnt];
    int gameTime;
};
```

同时在蚂蚁类中以`bool`值定义了蚂蚁行进的方向，以右为正：

```cpp
/*
 The Ant class.
 */
class Ant
{
private:
    int antId;
    double velocity;
    bool direction;     // True stands for right.
    double location;
    bool isAlive;       // True stands for alive.
    
public:
    
};
```

`GameRoom`类如下构造：

```cpp
/*
 The GameRoom class.
 */
class GameRoom
{
private:
    int incTime;
    GameData stGameData[DefaultAnt.GroupCnt];
    
public:
    GameRoom ();
    
    void buildDirections ();
    void playGames ();
    void start ();
    
};
```

初步思想如下：

将结构体数组中按用于存放方向的数组展开，组合成$2^n$行，$n$列的矩阵，其中第$i$行$j$列的项为`stGameData[i].antDirection[j]`。

第一列自上而下依次赋值$0, 1, 0, 1, 0, 1, ···$。

第二列自上而下依次赋值$0, 0, 1, 1, 0, 0, 1, 1, ···$。

第三列自上而下依次赋值$0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, ···$。

即`stGameData[i].antDirection[j] = (i >> j) % 2`。

因而如下构造生产函数：

```cpp
/*
 Post: Every situation is generalized.
 */
void GameRoom::buildDirections ()
{
    for (int divis = 0; divis < DefaultAnt.antcnt; divis ++)
    {
        int tmpdivi = pow (2, divis);
        for (int i = 0; i < DefaultAnt.GroupCnt; i += 2 * tmpdivi)
        {
            for (int j = i; j < tmpdivi; j ++)
                stGameData[j].antDirection[divis] = true;
            for (int p = i + tmpdivi; p < i + 2 * tmpdivi; p ++)
                stGameData[p].antDirection[divis] = false;
        }
    }
}
```

第一层`for`循环用于设置计算$n$次，第二层`for`循环用于计算每一个结构题内方向数组应从第几位开始赋值$0$，最内层的两个`for`循环用于赋值$0$和$1$

算法时间复杂度可能稍高······

# 完整代码

最后贴上OOAD思想写的爬杆问题解法：

```cpp
//
//  Ant.h
//  Ant
//
//
 
#ifndef Ant_h
#define Ant_h
 
#include <math.h>
 
struct DefaultStickData
{
    const double leftEnd = 0;
    const double rightEnd = 300;
};
 
struct DefaultAntData
{
    const int antcnt = 5;
    const int GroupCnt = 32;
    const double speed = 5;
    const bool direct = true;
    const double loc[5] = {30, 80, 110, 160, 250};
};
 
const DefaultStickData DefaultStick;
const DefaultAntData DefaultAnt;
 
 
 
struct GameData
{
    bool antDirection[DefaultAnt.antcnt];
    int gameTime;
};
 
 
/*
 The Ant class.
 */
class Ant
{
private:
    int antId;
    double velocity;
    bool direction;     // True stands for right.
    double location;
    bool isAlive;       // True stands for alive.
    
public:
    Ant ();
    void setAnt (int antID, double vel, bool dir, double loc);
    
    void changeDirection ();
    void creeping ();
    bool isColllision (bool isCol);
    bool isLive ();
    void changeLive ();
    
    double getLocation ();
    double getVelocity ();
    bool getDirection ();
    
};
 
/*
 Post: Ant class is initialized.
 */
Ant::Ant ()
{
    
}
 
void Ant::setAnt (int antID, double vel, bool dir, double loc)
{
    antId = antID;
    velocity = vel;
    direction = dir;
    location = loc;
    isAlive = true;
}
 
/*
 Post: The ant's direction is changed.
 */
void Ant::changeDirection ()
{
    if (isAlive)
        direction = !direction;
}
 
/*
 Post: The function keeps the ant creeping by 1 second.
 */
void Ant::creeping ()
{
    if (isAlive)
        if (direction == true)
            location += velocity;
        else
            location -= velocity;
}
 
/*
 Post: This function returns a bool value on the basis of isCol given by the detectCollision function in CreepingGame.
 */
bool Ant::isColllision (bool isCol)
{
    return isCol;
}
 
/*
 Post: The status of the ant is retuned.
 */
bool Ant::isLive ()
{
    return isAlive;
}
 
/*
 Post: The status of the ant is changed.
 */
void Ant::changeLive ()
{ 
    if (isAlive)
        isAlive = !isAlive;
}
 
/*
 Post: The function prints the ant's location.
 */
double Ant::getLocation ()
{
    return location;
}
 
/*
 Post: The function prints the ant's velocity.
 */
double Ant::getVelocity ()
{
    return velocity;
}
 
/*
 Post: The function prints the ant's direction.
 */
bool Ant::getDirection()
{
    return direction;
}
 
 
/*
 The Stick class.
 */
class Stick
{
private:
    double leftLocation;
    double rightLocation;
    int livingAnts;
    
public:
    Stick ();
    void setStick (double leftLoc, double rightLoc);
    
    bool isOut (Ant tmpAnt);
    
    void killAnt ();
    int getLivAntCnt ();
    
};
 
/*
 Post: The stick is initialized, giving the value of leftLocation is smaller than that of rightLocation.
 */
Stick::Stick ()
{
    
}
 
void Stick::setStick (double leftLoc, double rightLoc)
{
    leftLocation = leftLoc;
    rightLocation = rightLoc;
    livingAnts = DefaultAnt.antcnt;
}
 
/*
 Post: The function examines whether the given ant is out of the stick, true stands for out.
 */
bool Stick::isOut (Ant tmpAnt)
{
    if (tmpAnt.getLocation () <= leftLocation || tmpAnt.getLocation () >= rightLocation)
        return true;
    return false;
}
 
/*
 Post: The amount of ants decreases by 1.
 */
void Stick::killAnt ()
{
    livingAnts --;
}
 
/*
 Post: The amount of living ants is returned.
 */
int Stick::getLivAntCnt ()
{
    return livingAnts;
}
 
 
/*
 The CreepingGame class.
 */
class CreepingGame
{
private:
    int gameTime;
    bool isGameOver;       // True stands for not over.
    double incTim;
    Ant livant[DefaultAnt.antcnt];
    Stick curstick;
    
public:
    CreepingGame (int gameTim = 0, bool isGameOve = false, double incT = 1);
    
    void drivingGame ();
    void startGame (GameData gData);
    void detectCollision ();
    bool isAllDead ();
    
    bool getGameStatus ();
    int getGameTime ();
};
 
/*
 Post: The Game is initialized.
 */
CreepingGame::CreepingGame (int gameTim, bool isGameOve, double incT)
{
    gameTime = gameTim;
    isGameOver = isGameOve;
    incTim = incT;
}
 
/*
 Post: The game's time is increased by 1 second;
 */
void CreepingGame::drivingGame ()
{
    while (1)
    {
        gameTime += incTim;
        
        detectCollision ();
        
        for (int i = 0; i < DefaultAnt.antcnt; i++)
            if (livant[i].isLive ())
                livant[i].creeping ();
        
        for (int i = 0; i < DefaultAnt.antcnt; i++)
        {
            if (livant[i].isLive ())
                if (curstick.isOut (livant[i]))
                {
                    livant[i].changeLive ();
                    curstick.killAnt ();
                }
        }
        
        if (isAllDead () == true)
            break;
    }
    
    isGameOver = true;
}
 
/*
 Post: The game is started and the stick and ants are initialized.
 */
void CreepingGame::startGame (GameData gData)
{
    curstick.setStick (DefaultStick.leftEnd, DefaultStick.rightEnd);
    
    for (int i = 0; i < DefaultAnt.antcnt; i ++)
        livant[i].setAnt (i, DefaultAnt.speed, gData.antDirection[i], DefaultAnt.loc[i]);
    
}
 
/*
 Post: Collision are detected and ants' directions are changed.
 */
void CreepingGame::detectCollision ()
{
    int tmpantid = -1;
    for (int i = 0; i < DefaultAnt.antcnt; i ++)
    {
        tmpantid = -1;
        if (livant[i].isLive ())
        {
            if (livant[i].getDirection () == true)
            {
                for (int j = 0; j < DefaultAnt.antcnt; j ++)
                    if (livant[j].isLive ())
                    {
                        if (tmpantid == -1)
                        {
                            if (livant[j].getLocation () > livant[i].getLocation ())
                                tmpantid = j;
                        }
                        else
                        {
                            if (livant[j].getLocation () > livant[i].getLocation () && livant[j].getLocation () < livant[tmpantid].getLocation ())
                                tmpantid = j;
                        }
                    }
                if (tmpantid != -1)
                    if (abs (livant[i].getLocation () - livant[tmpantid].getLocation ()) <= (livant[i].getVelocity () + livant[tmpantid].getVelocity ()))
                    {
                        livant[i].changeDirection ();
                        livant[tmpantid].changeDirection ();
                    }
            }
            else
            {
                for (int j = 0; j < DefaultAnt.antcnt; j ++)
                    if (livant[j].isLive ())
                    {
                        if (tmpantid == -1)
                        {
                            if (livant[j].getLocation () < livant[i].getLocation ())
                                tmpantid = j;
                        }
                        else
                        {
                            if (livant[j].getLocation () < livant[i].getLocation () && livant[j].getLocation () > livant[tmpantid].getLocation ())
                                tmpantid = j;
                        }
                    }
                if (tmpantid != -1)
                    if (abs (livant[i].getLocation () - livant[tmpantid].getLocation ()) <= (livant[i].getVelocity () + livant[tmpantid].getVelocity ()))
                    {
                        livant[i].changeDirection ();
                        livant[tmpantid].changeDirection ();
                    }
            }
        }
    }
}
 
/*
 Post: The function judges whether all the ants are dead.
 */
bool CreepingGame::isAllDead ()
{
    if (curstick.getLivAntCnt () <= 0)
        return true;
    return false;
}
 
/*
 Post: The status of the game is returned.
 */
bool CreepingGame::getGameStatus ()
{
    return isGameOver;
}
 
/*
 Post: The time of the game is returned.
 */
int CreepingGame::getGameTime ()
{
    return gameTime;
}
 
 
/*
 The GameRoom class.
 */
class GameRoom
{
private:
    int incTime;
    GameData stGameData[DefaultAnt.GroupCnt];
    
public:
    GameRoom ();
    
    void buildDirections ();
    void playGames ();
    void start ();
    
};
 
/*
 Post: The function initializes the class.
 */
GameRoom::GameRoom ()
{
    incTime = 1;
    
    for (int i = 0; i < DefaultAnt.GroupCnt; i ++)
        stGameData[i].gameTime = 0;
}
 
/*
 Post: Every situation is generalized.
 */
void GameRoom::buildDirections ()
{
    for (int divis = 0; divis < DefaultAnt.antcnt; divis ++)
    {
        int tmpdivi = pow (2, divis);
        for (int i = 0; i < DefaultAnt.GroupCnt; i += 2 * tmpdivi)
        {
            for (int j = i; j < tmpdivi; j ++)
                stGameData[j].antDirection[divis] = true;
            for (int p = i + tmpdivi; p < i + 2 * tmpdivi; p ++)
                stGameData[p].antDirection[divis] = false;
        }
    }
}
 
/*
 Post: Games are played.
 */
void GameRoom::playGames ()
{
    CreepingGame creep[DefaultAnt.GroupCnt];
    for (int i = 0; i < DefaultAnt.GroupCnt; i ++)
    {
        creep[i].startGame (stGameData[i]);
        creep[i].drivingGame();
        stGameData[i].gameTime = creep[i].getGameTime ();
    }
    
    int maxtime = 0;
    int mintime = stGameData[0].gameTime;
    
    for (int j = 0; j < DefaultAnt.GroupCnt; j ++)
    {
        if (stGameData[j].gameTime > maxtime)
            maxtime = stGameData[j].gameTime;
        if (stGameData[j].gameTime < mintime)
            mintime = stGameData[j].gameTime;
    }
    
    std::cout << "Max Time is " << maxtime << std::endl;
    std::cout << "Min Time is " << mintime << std::endl;
}
 
/*
 Post: Game starts.
 */
void GameRoom::start ()
{
    std::cout << "Game started." << std::endl;
    buildDirections ();
    playGames ();
}
 
#endif /* Ant_h */
```

```cpp
//
//  main.cpp
//  Ant
//
//
 
#include <iostream>
#include "Ant.h"
 
int main() {
    GameRoom room;
    room.start ();
}
```
