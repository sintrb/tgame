// InRunan WebSocket Event
export default {
    init(B) {
        B.IRWS = function (options) {
            options = options || {};
            var wsurl = (options.wsurl || (window.location.protocol == "http:" ? "ws://" : "wss://") + window.location.host + "/ws/") + (options.channel || "default");
            var ws = wx.connectSocket({
                url: wsurl,
            });
            var thiz = this;
            thiz.ws = ws;
            thiz.isopen = false;
            // 打开Socket
            thiz.queue = [];
            thiz.subscribeMap = {};
            ['onopen', 'onclose', 'onerror'].forEach(function (m) {
                if (options[m]) {
                    thiz[m] = options[m];
                }
            });
            thiz.checkQueue = function () {
                while (thiz.queue.length) {
                    var msg = thiz.queue.shift();
                    // ws.send(msg);
                    ws.send({
                        data: msg,
                    })
                }
            };
            ws.onerror = function () {
                setTimeout(function(){
                    if (thiz.onerror) {
                        thiz.onerror();
                    }
                }, 100);
            };
            thiz.rawsend = function (data) {
                if (thiz.isclose)
                    throw "websocket closed";
                options.beforesend && options.beforesend(data);
                var msg = JSON.stringify(data);
                if (thiz.isopen) {
                    thiz.checkQueue();
                    // ws.send(msg);
                    ws.send({
                        data: msg,
                    })
                }
                else {
                    thiz.queue.push(msg);
                }
            };
            thiz.subscribe = function (tag, callback) {
                if (!tag)
                    tag = 'default';
                if (!(tag in thiz.subscribeMap)) {
                    thiz.subscribeMap[tag] = [];
                }
                thiz.subscribeMap[tag].push(callback);
                thiz.rawsend({
                    type: 'subscribe', tag: tag
                });
            };
            thiz.send = function (data, tag) {
                thiz.rawsend({
                    type: 'data', tag: tag || 'default', data: data
                });
            };

            // 执行方法
            thiz.seq = 0;
            thiz.seqmap = {};
            thiz.method = function (method, data, cbk) {
                if (cbk) {
                    thiz.seq += 1;
                    thiz.seqmap[thiz.seq] = {
                        cbk: cbk,
                    };
                    thiz.rawsend({ type: "method", tag: method, data: data, _seq: thiz.seq });
                }
                else {
                    thiz.rawsend({ type: "method", tag: method, data: data });
                }
            };
            thiz.onmethod = function (data) {
                var seq = data._seq;
                if (seq in thiz.seqmap) {
                    thiz.seqmap[seq].cbk(data.data);
                    delete thiz.seqmap[seq];
                }
            };

            // End执行方法

            ws.onopen = function (event) {
                thiz.isopen = true;
                thiz.checkQueue();
                ws.onclose = function (event) {
                    thiz.isclose = true;
                    thiz.isopen = false;
                    if (thiz.onclose) {
                        thiz.onclose();
                    }
                    // clear method
                    for (var k in thiz.seqmap) {
                        thiz.seqmap[k] && thiz.seqmap[k].cbk && thiz.seqmap[k].cbk(null);
                    }
                    thiz.seqmap = {};
                };
                ws.onmessage = function (event) {
                    try {
                        var data = JSON.parse(event.data);
                    } catch (e) {
                        console.log(event.data);
                    }
                    if (data.type == "data") {
                        var tag = data.tag;
                        if (thiz.subscribeMap[tag]) {
                            thiz.subscribeMap[tag].forEach(function (callback) {
                                callback(data.data);
                            })
                        }
                    }
                    else if (data.type == "method") {
                        thiz.onmethod && thiz.onmethod(data);
                    }
                    else if (data.type == "subscribe") {
                        thiz.cid = data.data.cid;
                    }
                };
                if (thiz.onopen) {
                    thiz.onopen();
                }
            };
            thiz.close = function () {
                ws.close();
            };

            ws.onOpen(function(e){
                ws.onopen(e);
            });
            ws.onError(function(e){
                console.log('ws onError')
                ws.onerror(e.errMsg);
            });
            ws.onClose(function (e) {
                console.log('ws onClose')
                ws.onclose && ws.onclose(e);
            });
            ws.onMessage(function(e){
                ws.onmessage(e);
            });
        };

        B.IRWSV2 = function (options) {
            var thiz = {
                userclose: false,
            };
            thiz.connect = function () {
                console.log('connectting...');
                thiz.ws = new B.IRWS(options);
                return thiz.ws;
            };
            var rawonopen = options.onopen;
            options.onopen = function () {
                console.log('connected!');
                if (options.subscribe) {
                    Object.keys(options.subscribe).map(function (tag) {
                        thiz.ws.subscribe(tag, options.subscribe[tag]);
                    });
                }
                if (thiz.attachdata) {
                    thiz.attach(thiz.attachdata);
                }
                rawonopen && rawonopen();
            };
            var rawonerror = options.onerror;
            options.onerror = function () {
                console.log("error");
                if (!thiz.userclose) {
                    setTimeout(thiz.connect, 30000);
                }
                rawonerror && rawonerror();
            };
            var rawonclose = options.onclose;
            options.onclose = function () {
                console.log("closed");
                if (!thiz.userclose) {
                    setTimeout(thiz.connect, 3000);
                }
                rawonclose && rawonclose();
            };
            thiz.send = function (data, tag) {
                return thiz.ws.send(data, tag);
            };
            thiz.close = function () {
                thiz.userclose = true;
                return thiz.ws.close();
            };

            thiz.callapi = function (method, data, cbk, err) {
                thiz.ws.method(method, data, !cbk && !err ? null : function (res) {
                    if (!res || res.code != 0) {
                        if (err) {
                            err(res);
                        }
                        else if (cbk) {
                            cbk(null);
                        }
                    }
                    else {
                        cbk && cbk(res);
                    }
                });
            };

            thiz.change = function (channel) {
                thiz.ws.rawsend({ type: "command", tag: 'change', channel: channel });
                options.channel = channel;
            }

            thiz.attachdata = null;
            thiz.attach = function (data) {
                thiz.attachdata = Object.assign(thiz.attachdata || {}, data);
                thiz.ws.rawsend({ type: "command", tag: 'attach', data: data });
            }

            thiz.connect();
            return thiz;
        }
    }
}
