import IRWS from '../base/irws.js'
import {
    gen_uuid
} from '../base/utils.js'
let B = {};
IRWS.init(B);
const app = getApp();
const maxSpeed = 10;
const maxRate = 100;
const clientId = gen_uuid();
const ticksGap = 10; // ticks 间隔
Page({
    data: {
        clientId: clientId,
        roomId: null,
        hostId: null,
        host: null,
        users: [],
        user: null,

        game: 'race',
        status: 'running',
        wxacodeBase: 'http://tool.inruan.com/wxacode/?appid=wx3fbb58c5131e8fe1&appsecert=f87071ff08124380b1b2b8c3b3ec6b03&page=pages/index',

        isShowShare: false,
        isShowInput: false,
        version: '1.0.5',
        completeCount: 0,
    },

    onLoad(options) {
        let thiz = this;
        var roomId = options.roomId || options.scene;
        if (roomId) {
            this.setData({
                roomId
            });
        }

        this.initGame();
        this.connectWs();
        this.ticksTm = setInterval(function() {
            if (thiz.data.hostId == thiz.data.clientId) {
                thiz.sendMsgByType({
                    host: thiz.data.user,
                    hostId: thiz.data.clientId,
                    users: thiz.data.users,
                }, 'room');
            } else {
                thiz.sendMsgByType({}, 'ticks');
            }
        }, ticksGap * 1000);

        setInterval(() => {
            let users = this.data.users;
            var changed = false;
            let limit = Date.now() - ticksGap * 1000 * 3;
            users.map(user => {
                if (this.tickUser(user) || user.last < limit) {
                    changed = true;
                }
            })
            if (changed) {
                this.setData({
                    users: users.filter(user => {
                        if (user.last < limit) {
                            this.addMsgTips(`${user.name} 离开`, 'tips');
                            return false;
                        } else {
                            return true;
                        }
                    }),
                });
            }
        }, 100);


        // 用户授权
        // 查看是否授权
        wx.getSetting({
            success(res) {
                if (res.authSetting['scope.userInfo']) {
                    // 已经授权，可以直接调用 getUserInfo 获取头像昵称
                    wx.getUserInfo({
                        success: (res) => {
                            thiz.initUser(res.userInfo)
                        }
                    })
                }
            }
        });
    },

    onUnload() {
        this.destroyGame();
        this.disconnectWs();
        if (this.ticksTm) {
            clearInterval(this.ticksTm);
            this.ticksTm = 0;
        }
    },

    addMsgTips(msg, tp) {
        console.log(msg, tp || '');
        if (tp == 'sys') {
            this.sendMsgByType({
                msg: msg,
                type: tp,
            }, 'msg');
        }
    },

    addSpeed(user, v) {
        if (!v)
            v = 1;
        if (!user.speed) {
            user.speed = 0;
        }
        if (!user.rate)
            user.rate = 0;
        if (user.rate < maxRate && user.speed < maxSpeed) {
            user.speed += v;
            if (user.speed > maxSpeed)
                user.target = maxSpeed;
            return true;
        }
    },

    tickUser(user) {
        if (!user.rate)
            user.rate = 0;
        if (user.rate < maxRate && user.speed) {
            user.rate += Math.max(user.speed / 2 / 5.0, 0.2);
            user.speed -= 0.5;
            if (user.speed < 0) {
                user.speed = 0;
            }
            if (user.rate > maxRate) {
                user.rate = maxRate
                let isHost = this.data.clientId == this.data.hostId;
                if (!user.rank && isHost) {
                    this.setData({
                        completeCount: (this.data.completeCount || 0) + 1
                    });
                    user.rank = this.data.completeCount;
                    this.syncUsers();
                }
            }
            return true;
        }
    },

    connectWs() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        if (!this.data.roomId) {
            return;
        }
        let thiz = this;
        let subscribe = {};
        subscribe[this.data.roomId] = (msg) => {
            this.onWsMessage(msg);
        };
        this.addMsgTips("正在连接...");
        this.ws = new B.IRWSV2({
            wsurl: "wss://irapi.inruan.com/ws/",
            channel: "i153910242166",
            subscribe: subscribe,
            onopen() {
                thiz.addMsgTips("连接成功!", 'success');
            },
            onerror() {
                thiz.addMsgTips("通信故障!", 'error');
            },
            onclose() {
                thiz.addMsgTips("通信断开!", 'tips');
            },
        });
        this.setAttachedData();
        wx.setNavigationBarTitle({
            title: '房间 ' + this.data.roomId,
        });
    },
    disconnectWs() {
        this.ws && this.ws.close();
        this.ws = null;
        wx.setNavigationBarTitle({
            title: '团队游戏百宝箱',
        });
    },
    setAttachedData() {
        if (this.ws && this.data.user) {
            let data = Object.assign({
                roomId: this.data.roomId,
                version: this.data.version,
            }, this.data.user);
            this.ws.attach(data);
        }
    },
    sendRawMsg(msg) {
        if (this.ws) {
            this.ws.send(msg, this.data.roomId);
            return true;
        } else {
            return false;
        }
    },
    sendMsgByType(data, mtype) {
        let msg = {
            type: mtype,
            data: data
        };
        if (this.data.user) {
            msg.user = this.data.user;
        }
        if (this.sendRawMsg(msg))
            this.onWsMessage(msg);
        return msg;
    },
    onWsMessage(data) {
        let isHost = this.data.clientId == this.data.hostId;
        if (data.type == 'ticks' || data.type == 'run') {
            if (isHost && data.user) {
                let users = this.data.users;
                let uid = data.user.id || data.data.id;
                let rawlen = users.length;
                var updated = false;
                var user = users.find((u) => {
                    return u.id == uid;
                });
                if (!user) {
                    user = Object.assign({
                        last: Date.now()
                    }, data.user);
                    users.push(user);
                    this.addMsgTips(`${user.name} 加入`, 'sys');
                } else {
                    user.last = Date.now();
                }
                if (user && data.type == 'run' && data.data.speed) {
                    updated = this.addSpeed(user, data.data.speed);
                }
                if (updated || rawlen != users.length) {
                    this.setData({
                        users
                    });
                    this.syncUsers();
                }
            }
            return;
        } else if (data.type == 'exit') {
            let uid = data.user.id || data.data.id;
            var users = this.data.users.filter((u) => {
                if (u.id == uid) {
                    this.addMsgTips(`${u.name} 离开`, 'sys');
                }
                return u.id != uid;
            });
            console.log(users);
            this.setData({
                users: users,
            });
            this.syncUsers();
        } else if (data.type == 'room') {
            let rawHostId = this.data.hostId;
            this.setData(data.data);
            if (this.data.hostId != this.data.clientId && rawHostId != this.data.hostId) {
                this.sendMsgByType({}, 'ticks');
            }
        } else if (data.type == 'users') {
            this.setData({
                users: data.data.users,
            })
        } else if (data.type == 'msg') {
            wx.showToast({
                title: data.data.msg,
                icon: 'none',
            })
        } else {
            console.log('unknown ws msg', data);
        }
    },
    reset() {
        let users = this.data.users;
        let uix = Math.floor(Math.random() * users.length);
        users.map(user => {
            user.rate = 0;
            user.speed = 0;
            user.rank = 0;
        })
        this.setData({
            users: users,
            completeCount: 0,
        });
        this.syncUsers();
        this.addMsgTips(`重新开始！`, 'sys');
    },
    runMe(speed) {
        this.sendMsgByType({
            id: this.data.user.id,
            speed: speed,
        }, 'run')
    },
    runTap() {
        this.runMe(1);
    },
    initGame() {
        wx.startAccelerometer({
            interval: 'normal',
        });
        wx.onAccelerometerChange((ac) => {
            let now = Date.now();
            let isHost = this.data.clientId == this.data.hostId;
            if (!isHost && this.lastAc && this.data.status == 'running') {
                let lac = this.lastAc;
                let speed = Math.floor(Math.abs(lac.x + lac.y + lac.z - ac.x - ac.y - ac.z) / (now - lac.tm) * 10000 / 40);
                if (speed) {
                    this.runMe(speed);
                }
                console.log(speed);
            }
            this.lastAc = Object.assign({
                tm: now
            }, ac);
        })
    },
    destroyGame() {
        wx.stopAccelerometer();
    },
    bindGetUserInfo(e) {
        this.initUser(e.detail.userInfo)
    },
    initUser(user) {
        this.setData({
            user: {
                name: user.nickName,
                icon: user.avatarUrl,
                id: clientId,
            }
        });
        this.sendMsgByType({}, 'ticks');
        this.setAttachedData();
    },
    syncUsers() {
        this.sendMsgByType({
            users: this.data.users,
            completeCount: this.data.completeCount,
        }, 'users');
    },
    asHost() {
        this.sendMsgByType({
            host: this.data.user,
            hostId: clientId
        }, 'room');
        this.setData({
            users: [],
        });
        this.syncUsers();
    },
    onShow() {
        if (this.data.user && this.data.hostId != this.data.clientId) {
            this.sendMsgByType({}, 'ticks');
        }
    },
    saveImage(e, imgSrc) {
        var current = e.target.dataset.src;
        wx.previewImage({
            current: current,
            urls: [current]
        });
    },
    onShareAppMessage(res) {
        //if (res.from === 'button') {} else {}
        return {
            title: '我在房间' + this.data.roomId + '等你，快来加入游戏吧！',
            path: 'pages/index?roomId=' + this.data.roomId,
            imageUrl: this.data.wxacodeBase + '&scene=' + this.data.roomId,
            success: (res) => {
                // console.log("转发成功", res);
                this.addMsgTips(`${this.data.user.name} 分享房间`, 'sys');
                this.setData({
                    isShowShare: false,
                });
            },
            fail: (res) => {
                console.log("转发失败", res);
            }
        }
    },
    toggleShowShare() {
        this.setData({
            isShowShare: !this.data.isShowShare
        })
    },
    toggleShowInput() {
        this.setData({
            isShowInput: !this.data.isShowInput
        })
    },
    createRoom() {
        var roomId = "00000" + new String(Math.floor(Date.now() / 1000) % 1000);
        roomId = roomId.substring(roomId.length - 4);
        this.disconnectWs();
        this.setData({
            roomId: roomId,
            hostId: this.data.clientId,
            isShowShare: true,
            users: [],
        });
        this.connectWs();
    },
    exitRoom() {
        wx.showLoading({
            title: '...',
        });
        this.sendMsgByType({}, 'exit');
        this.disconnectWs();
        setTimeout(() => {
            wx.hideLoading();
            this.setData({
                roomId: null,
            });
        }, 500);
    },
    joinRoom() {
        if (this.data.inputRoomId) {
            this.disconnectWs();
            this.setData({
                roomId: this.data.inputRoomId,
                isShowInput: false,
            });
            this.connectWs();
            this.sendMsgByType({}, 'ticks');
        }
    },
    onInput(e) {
        if (e.currentTarget.dataset.key) {
            var data = {};
            data[e.currentTarget.dataset.key] = e.detail.value;
            this.setData(data);
        }
    }
})