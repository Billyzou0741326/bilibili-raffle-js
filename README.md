# bilibili-raffle-js (b站直播挂机、高能+舰长抽取)
![Github](https://img.shields.io/github/license/Billyzou0741326/bilibili-live-raffle-monitor)
![Github](https://img.shields.io/badge/nodejs-10.16.3-blue)

## Info
 - 此程序不收集任何用户信息/数据
 - 可自建服务器[bilibili-live-monitor-ts](https://github.com/Billyzou0741326/bilibili-live-monitor-ts), 也可以用默认的设定
 - 包括[bilibili-live-monitor-ts](https://github.com/Billyzou0741326/bilibili-live-monitor-ts)在内的所有项目永久开源 没有闭源的打算 亦不接受打赏
 - 实力不济没能写出更多功能 代码也非常难看23333
 - 有bug请务必反馈 Issues就是用来讨论的
 - 祝各位白嫖愉快~

## Features
 - 主站观看视频 (mainwatchvideo)
 - 主站分享视频 (mainsharevideo) 仅模拟 不会真实分享
 - 直播签到 (livesign)
 - 直播心跳 (liveheart)
 - 直播抽奖 (guard, gift, pk)
 - 双端观看 (doublewatch)
 - 银瓜子领取 (silverbox)
 - 友爱社签到 (idolclubsign)

## Usage (普通运行)
 1. **src/client/default-user-info.json** 填写用户名/密码 (这个版本用到了app端的access_tokens，所以不能只提供cookies)
 2. `npm install` 安装依赖库
 2. `node src/main.js` 运行
 3. 程序自带抽奖休眠(见[任务设置](#任务设置)) 可以用pm2永久运行程序

## pm2运行
 1. `npm install` 安装依赖库
 2. `npm install -g pm2` 全局安装PM2
 3. `pm2 src/main.js` 运行程序
 4. `pm2 ls` 查看运行状态 名为main那个就是了 (如果状态是errored 用下一步看下日志 反馈issues)
 5. `pm2 logs main --lines 100` 查看100行日志 (**CTRL-C 退出日志状态**)
 6. `pm2 stop main; pm2 delete main` 停止+删除程序进程

## Config

### 监听server与http任务管理设置

 - **Config file `/src/settings.json`**
 - httpServer为账号/任务管理界面设定 (未实现 我太菜了)
 - wsServer为舰长+抽奖服务器设定，支持多服务器，每个服务器可单独设置可选参数，例如下示的备用服务器设置可以用不同颜色显示，并且只显示连接和断线信息
 - receiver为抽奖监听设定
 - notifier为定时任务通知设定
 - account为一些账号任务运行杂项设置，包括每秒最大请求数，已进入房间追踪数组最大长度，在访问被拒绝的情况下小黑屋检查间隔时间（单位为小时）

```javascript
{
    "httpServer": {
        "host": "127.0.0.1",
        "port": 8899
    },
    "wsServer": [
        {
            "host": "warpgate.cat.pdx.edu",        // 如果自建服务器的话请务必换成自己的ip 本机的话是127.0.0.1
            "port": 8999
        },
        {
            "host": "127.0.0.1",
            "port": 8999,
            "retries": 1,                          // 【可选设置】断线后短时间内重试次数。如果短时间内重试失败会等待一段时间后尝试重新连接。默认值为3
            "reconnectWaitTime": 60,               // 【可选设置】断线后重新连接等待时长（单位为秒）。默认值为10秒
            "healthCheckInterval": 10,             // 【可选设置】断线检测间隔（单位为秒）。默认值为5秒
            "healthCheckThreshold": 30,            // 【可选设置】断线检测阈值，从最后一次接收到ping请求算起（单位为秒）。默认值为25秒
            "enableConnectionErrorLogging": false, // 【可选设置】是否显示连接错误信息（如果备用服务器不是一直在线的话建议关闭）。默认值为true
            "enableConnectionRetryLogging": false, // 【可选设置】是否显示连接重试信息（如果备用服务器不是一直在线的话建议关闭）。默认值为true
            "infoColor": "white",                  // 【可选设置】普通连接信息显示颜色。默认值为green（绿色）
            "errorColor": "yellow"                 // 【可选设置】连接错误信息显示颜色。默认值为red（红色）
        }
    ],
    "storm": {
        "rate": 0.6                                // 风暴参与几率 (0.6 == 60%)
    },
    "receiver": {
        "janitorInterval": 1,                      // 【可选设置】已参与抽奖的礼物ID缓存清理间隔（单位为分）。默认值为1分钟
        "expiryThreshold": 5                       // 【可选设置】已参与抽奖的礼物ID在缓存内过期后的存留时长（单位为分）。默认值为5分钟
    },
    "notifier": {
        "heartbeatInterval": 5,                    // 【可选设置】双端直播心跳发送间隔（单位为分）。默认值为5分钟
        "midnightCheckInterval": 60                // 【可选设置】午夜判定检测间隔（单位为分）。默认值为60分钟。如果担心银瓜子最后领取时间（正常3轮54分钟，老爷5轮90分钟）超过心跳任务设置的时间太多（默认工作日0:45，周末2：00），可将本设置缩短，例如设为5分钟
    },
    "account": {
        "maxRequestsPerSecond": 50,                // 【可选设置】每秒最大请求数。默认值为50。设置过大容易造成412风控IP
        "maxNumRoomEntered": 30,                   // 【可选设置】已进入房间追踪数组最大长度。默认值为30。已在数组内的房间再次抽奖时不再发送进入信息。可以简单理解为同时打开n个房间的直播页面
        "blacklistCheckInterval": 24,              // 【可选设置】在访问被拒绝的情况下小黑屋检查间隔时间（单位为小时）。默认值为24小时。在检测到拒绝访问后不再参与抽奖和领取银瓜子，并且会依此设置等待一段时间后再次检测
        "stormJoinMaxInterval": 60,                // 【可选设置】节奏风暴领取请求最大间隔（单位为毫秒）。节奏风暴领取时会以快速多重请求方式发送，一般情况下在前一个请求执行完毕后才会发送下一个请求，但在网络延迟大的情况下会以不超过此设置的间隔发送。默认值为60毫秒
        "abandonStormAfter": 25                    // 【可选设置】如果节奏风暴在设定的时间段内未能成功领取，则放弃重试（单位为秒）。默认值为25秒
    }
}
```

### 账号设置

 - **Config file `/src/client/default-user-info.json`**
 - 填入账号信息并成功登录后，程序自动以相同的格式写入 `src/client/user.json`，此后都从`src/client/user.json`读取账号和登录信息
 - 与Python版的区别：JS实现包括但不限于主站任务、双端观看功能，因此app的两项也必须填上 （仅填cookies不执行任何任务）

```javascript
{
    "user": {
        "username": "",
        "password": ""
    },
    "app": {
        "access_token": "",
        "refresh_token": ""
    },
    "web": {
        "bili_jct": "",
        "DedeUserID": "",
        "DedeUserID__ckMd5": "",
        "sid": "",
        "SESSDATA": ""
    }
}
```

### 任务设置

 - **Config file `/src/client/default-task-settings.json`**
 - **"status": 1 为开启** **"status": 0 为关闭**
 - 默认所有任务开启，所有抽奖、心跳任务于北京时间工作日 08:00 - 0:45 ，周末 09:00 - 02:00 时间段执行
 - 修改from、to的hours、minutes数值可以自定义抽奖时间段
 - weekdays允许值为0-6，对应星期日，一到六。可用逗号分隔，且可以用连接号定义区间，比如0-2,4,6代表周日到周二，加周四和周六
 - 还请不要修改type ~

```javascript
{
    "pk": {
        "type": "scheduled",
        "status": 1,
        "timeperiod": [
            {
                "from": {
                    "hours": 8,
                    "minutes": 0
                },
                "to": {
                    "hours": 0,
                    "minutes": 45
                },
                "weekdays": "1-4"
            },
            {
                "from": {
                    "hours": 8,
                    "minutes": 0
                },
                "to": {
                    "hours": 2,
                    "minutes": 0
                },
                "weekdays": "5"
            },
            {
                "from": {
                    "hours": 9,
                    "minutes": 0
                },
                "to": {
                    "hours": 2,
                    "minutes": 0
                },
                "weekdays": "6"
            },
            {
                "from": {
                    "hours": 9,
                    "minutes": 0
                },
                "to": {
                    "hours": 0,
                    "minutes": 45
                },
                "weekdays": "0"
            }
        ]
    },
    "gift": {
        "type": "scheduled",
        "status": 1,
        "timeperiod": [
            {
                "from": {
                    "hours": 8,
                    "minutes": 0
                },
                "to": {
                    "hours": 0,
                    "minutes": 45
                },
                "weekdays": "1-4"
            },
            {
                "from": {
                    "hours": 8,
                    "minutes": 0
                },
                "to": {
                    "hours": 2,
                    "minutes": 0
                },
                "weekdays": "5"
            },
            {
                "from": {
                    "hours": 9,
                    "minutes": 0
                },
                "to": {
                    "hours": 2,
                    "minutes": 0
                },
                "weekdays": "6"
            },
            {
                "from": {
                    "hours": 9,
                    "minutes": 0
                },
                "to": {
                    "hours": 0,
                    "minutes": 45
                },
                "weekdays": "0"
            }
        ]
    },
    "guard": {
        "type": "scheduled",
        "status": 1,
        "timeperiod": [
            {
                "from": {
                    "hours": 8,
                    "minutes": 0
                },
                "to": {
                    "hours": 0,
                    "minutes": 45
                },
                "weekdays": "1-4"
            },
            {
                "from": {
                    "hours": 8,
                    "minutes": 0
                },
                "to": {
                    "hours": 2,
                    "minutes": 0
                },
                "weekdays": "5"
            },
            {
                "from": {
                    "hours": 9,
                    "minutes": 0
                },
                "to": {
                    "hours": 2,
                    "minutes": 0
                },
                "weekdays": "6"
            },
            {
                "from": {
                    "hours": 9,
                    "minutes": 0
                },
                "to": {
                    "hours": 0,
                    "minutes": 45
                },
                "weekdays": "0"
            }
        ]
    },
    "liveheart": {
        "type": "scheduled",
        "status": 1,
        "timeperiod": [
            {
                "from": {
                    "hours": 8,
                    "minutes": 0
                },
                "to": {
                    "hours": 0,
                    "minutes": 45
                },
                "weekdays": "1-4"
            },
            {
                "from": {
                    "hours": 8,
                    "minutes": 0
                },
                "to": {
                    "hours": 2,
                    "minutes": 0
                },
                "weekdays": "5"
            },
            {
                "from": {
                    "hours": 9,
                    "minutes": 0
                },
                "to": {
                    "hours": 2,
                    "minutes": 0
                },
                "weekdays": "6"
            },
            {
                "from": {
                    "hours": 9,
                    "minutes": 0
                },
                "to": {
                    "hours": 0,
                    "minutes": 45
                },
                "weekdays": "0"
            }
        ]
    },
    "livesign": {
        "type": "daily",
        "status": 1,
        "timeperiod": null
    },
    "idolclubsign": {
        "type": "daily",
        "status": 1,
        "timeperiod": null
    },
    "mainsharevideo": {
        "type": "daily",
        "status": 1,
        "timeperiod": null
    },
    "mainwatchvideo": {
        "type": "daily",
        "status": 1,
        "timeperiod": null
    },
    "silverbox": {
        "type": "daily",
        "status": 1,
        "timeperiod": null
    },
    "doublewatch": {
        "type": "daily",
        "status": 1,
        "timeperiod": null
    }
}
```


## Issues
有Bug请务必立刻反馈 (有使用方式的疑问或者任何功能方面的建议 也欢迎讨论)  
炸我邮箱<zouguanhan@gmail.com>  
