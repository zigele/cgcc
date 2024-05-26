class Signal {
    constructor() {
        this.crsAngleBitIndex = [];
        this.crsSignalNum = [];
        this.casSignalNum = [];
        this.CAS_HI = 3;
        this.CAS_LO = 2;
        this.CRS_HI = 1;
        this.CRS_LO = 0;
        this.option = null;
    }

    init() {
        for (let index = 0; index < 360; index++) {
            this.crsAngleBitIndex[index] = index;
        }
        /**
         *
         *初始化曲轴波形信号代码值
         * */
        for (let i = 0; i < 360; i++) {
            this.crsSignalNum[i] = this.CRS_HI;
        }
        /**
         *
         *初始化凸轮波形信号代码值
         * */
        for (let i = 0; i < 360; i++) {
            this.casSignalNum[i] = this.CAS_HI;
        }
        let that = this;
        this.option = {
            color: ['#ffc107', '#0dcaf0', '#d63384', "#fd7e14",
                '#6f42c1', '#0d6efd', '#dc3545'],
            useCoarsePointer: true,
            title: {
                text: "相位设定图",
            },
            toolbox: {
                left: "300px",
                top: "-5px",
                feature: {
                    saveAsImage: {},
                    restore: {},
                },
            },
            tooltip: {
                trigger: "axis",
                valueFormatter: function (value) {
                    if (value == that.CAS_LO || value == that.CRS_LO) {
                        return "低电平";
                    } else {
                        return "高电平";
                    }
                },
            },
            grid: {
                top: "40px",
                left: "50px",
                right: "10px",
                bottom: "50px",
            },
            legend: {
                left: "100px",
                show: true,
                data: ["凸轮信号", "曲轴信号"],
            },
            xAxis: {
                type: "category",
                data: that.crsAngleBitIndex,
                name: "曲轴转角",
                axisLabel: {
                    formatter: "{value}°",
                    textStyle: {
                        fontSize: '10'
                    },
                    rotate: '45'
                },
                interval: 0,
                axisTick: {
                    alignWithLabel: true,
                },
            },
            yAxis: {
                type: "value",
                axisLabel: {
                    formatter: function (value, index) {
                        if (value == that.CAS_LO || value == that.CRS_LO) {
                            return "低电平";
                        } else if (value == that.CAS_HI || value == that.CRS_HI) {
                            return "高电平";
                        }
                    },
                    textStyle: {
                        fontSize: '13'
                    }
                },
                splitLine: {
                    show: false
                }
            },
            series: [
                {
                    name: "凸轮信号",
                    type: "line",
                    showSymbol: true,
                    symbolSize: 10,
                    step: "end",
                    data: that.casSignalNum,
                },
                {
                    name: "曲轴信号",
                    type: "line",
                    symbolSize: 10,
                    step: "end",
                    data: that.crsSignalNum,
                    interval: 1,
                },
            ],
        };
    }
}


(function app() {
    //alert("该程序采用bootstrap v5 cdn库，需要联网！");
    const linkColor = document.getElementsByName("nav_item");

    function colorLink() {
        if (linkColor) {
            linkColor.forEach((l) => l.classList.remove("active"));
            this.classList.add("active");
        }
    }

    linkColor.forEach((l) => l.addEventListener("click", colorLink));

    function getByID(id) {
        return document.getElementById(id);
    }

    const protocol_header_1 = "#";
    const protocol_header_2 = "#";
    const SET_SPEED = 'A';
    const SET_CAS_MODEL = 'B';
    const SET_CRS_MODEL = 'C';
    const SET_WIFI_SSID = 'D';
    const SET_WIFI_PASSWORD = 'E';
    const SET_DAC0_VAL = 'F';
    const SET_DAC1_VAL = 'G';
    const RESET_NVS = 'H';
    const SAVE_CAS_MODEL = 'I';
    const SAVE_CRS_MODEL = 'J';

    let wsCode2NameDict = {
        1000: "正常关闭; 无论为何目的而创建, 该链接都已成功完成任务。",
        1001: "终端离开, 可能因为服务端错误, 也可能因为浏览器正从打开连接的页面跳转离开。",
        1002: "由于协议错误而中断连接。",
        1003: "由于接收到不允许的数据类型而断开连接 (如仅接收文本数据的终端接收到了二进制数据)。",
        1005: "保留。 表示没有收到预期的状态码。",
        1006: "保留。 用于期望收到状态码时连接非正常关闭 (也就是说, 没有发送关闭帧)。",
        1007: "由于收到了格式不符的数据而断开连接 (如文本消息中包含了非 UTF-8 数据)。",
        1008: "由于收到不符合约定的数据而断开连接。 这是一个通用状态码, 用于不适合使用 1003 和 1009 状态码的场景。",
        1009: "由于收到过大的数据帧而断开连接。",
        1010: "客户端期望服务器商定一个或多个拓展, 但服务器没有处理, 因此客户端断开连接。",
        1011: "客户端由于遇到没有预料的情况阻止其完成请求, 因此服务端断开连接。",
        1012: "服务器由于重启而断开连接。",
        1013: "服务器由于临时原因断开连接, 如服务器过载因此断开一部分客户端连接。",
        1015: "保留。 表示连接由于无法完成 TLS 握手而关闭 (例如无法验证服务器证书)。",
    }

    let ws = null;
    let dot = '.';
    let repeat_counter = 0, ws_connected = false, tip_text = '', ws_connecting = false;
    const date = new Date();
    let status_timer;
    let signals = new Signal()
    signals.init()

    engineChart = echarts.init(document.getElementById("signal-chart"));
    engineChart.setOption(signals.option, true);
    engineChart.on("click", function (params) {
        let ret = signals.option.series[params.seriesIndex];
        let arr_index = params.dataIndex;
        if (ret.name == signals.option.series[1].name) {
            if (ret.data[params.dataIndex] == signals.CRS_HI) {
                ret.data[params.dataIndex] = signals.CRS_LO;
            } else {
                ret.data[params.dataIndex] = signals.CRS_HI;
            }
        } else if (ret.name == signals.option.series[0].name) {
            if (ret.data[params.dataIndex] == signals.CAS_HI) {
                ret.data[params.dataIndex] = signals.CAS_LO;
            } else {
                ret.data[params.dataIndex] = signals.CAS_HI;
            }
        }
        engineChart.setOption(signals.option, true);
        engineChart.resize();
    })

    window.onload = function () {
        getByID("ws-url").value = localStorage.getItem("EGCC_WEBSOCKET_URL")
    }
    getByID("btn-connect").addEventListener("click", onConnect);

    function onConnect(event) {
        if (ws_connecting || ws_connected) {
            return;
        }
        try {
            ws = new WebSocket(getByID("ws-url").value.trim())
            ws.addEventListener("close", onWsClose, false);
            ws.addEventListener("message", onWsMessage, false);
            status_timer = setInterval(function () {
                if ((ws != null) && (!ws_connected)) {
                    repeat_counter++;
                    if (ws.readyState == WebSocket.CONNECTING) {
                        tip_text = date.toLocaleString('chinese', {hour12: false}) + " 正在连接." + dot.repeat(repeat_counter) + "\r\n"
                        getByID("tip-textarea").textContent = tip_text
                        getByID("connect-progress").style = "width:" + Math.round(repeat_counter / 22 * 100) + "%"
                        ws_connecting = true;
                        getByID("btn-connect").disabled = true;
                    }
                    if (ws.readyState == WebSocket.OPEN) {
                        tip_text += date.toLocaleString('chinese', {hour12: false}) + " 连接成功." + "\r\n"
                        getByID("tip-textarea").textContent = tip_text
                        getByID("connect-progress").style = "width:100%"
                        ws_connected = true;
                        repeat_counter = 0;
                        clearInterval(status_timer);
                        ws_connecting = false;
                        getByID("btn-connect").disabled = true;
                        localStorage.setItem('EGCC_WEBSOCKET_URL', getByID("ws-url").value.trim())
                    }
                }
            }, 1000)
        } catch (error) {
            console.log(error)

        }
    }

    function onWsClose(e) {
        console.log("onWsClose");
        tip_text += date.toLocaleString('chinese', {hour12: false}) + " 已经被关闭。原因:" + wsCode2NameDict[e.code] + "\r\n";
        getByID("tip-textarea").textContent = tip_text
        getByID("connect-progress").style = "width:0%"
        repeat_counter = 0;
        clearInterval(status_timer);
        ws_connecting = false;
        ws_connected = false;
        getByID("btn-connect").disabled = false;
    }

    const reader = new FileReader()  //fast will get an busy error
    reader.addEventListener("loadend", function (e) {
        showMesAlert(e.target.result)
    });

    function onWsMessage(e) {
        if (e.data instanceof Blob) {
            reader.readAsText(e.data);
        }
    }

    getByID("btn-close").addEventListener("click", onClose);

    function onClose(event) {
        if (ws != null) {
            try {
                ws.close();
            } catch (e) {
                tip_text += date.toLocaleString('chinese', {hour12: false}) + e + "\r\n";
                getByID("tip-textarea").textContent = tip_text;
            }
        } else {
            tip_text += date.toLocaleString('chinese', {hour12: false}) + " websocket未初始化。" + "\r\n";
            getByID("tip-textarea").textContent = tip_text;
        }
    }

    getByID("btn-set-ssid").addEventListener("click", setWifiSSID);

    function setWifiSSID() {
        try {
            if (ws.readyState == WebSocket.OPEN) {
                ws.send(protocol_header_1 + protocol_header_2 + SET_WIFI_SSID + getByID("wifi-ssid").value.trim())
                tip_text += date.toLocaleString('chinese', {hour12: false}) + " 设置WIFI名称: " + getByID("wifi-ssid").value.trim() + "成功\r\n"
            } else {
                tip_text += date.toLocaleString('chinese', {hour12: false}) + " websocket未连接。" + "\r\n"
            }
            getByID("tip-textarea").textContent = tip_text

        } catch (e) {
            tip_text += date.toLocaleString('chinese', {hour12: false}) + " " + e + "\r\n"
            getByID("tip-textarea").textContent = tip_text
        }
    }

    getByID("btn-reset-nvs").addEventListener("click", onResetNvs);

    function onResetNvs() {
        try {
            if (ws.readyState == WebSocket.OPEN) {
                ws.send(protocol_header + RESET_NVS)
                tip_text += date.toLocaleString('chinese', {hour12: false}) + " 芯片重置: " + "成功\r\n"
            } else {
                tip_text += date.toLocaleString('chinese', {hour12: false}) + " websocket未连接。" + "\r\n"
            }
            getByID("tip-textarea").textContent = tip_text
        } catch (e) {
            tip_text += date.toLocaleString('chinese', {hour12: false}) + " " + e + "\r\n"
            getByID("tip-textarea").textContent = tip_text
        }
    }

    getByID("btn-set-password").addEventListener("click", setWifiPASSWORD);

    function setWifiPASSWORD() {
        try {
            if (ws.readyState == WebSocket.OPEN) {
                ws.send(protocol_header_1 + protocol_header_2 + SET_WIFI_PASSWORD + getByID("wifi-passeord").value.trim())
                tip_text += date.toLocaleString('chinese', {hour12: false}) + " 设置WIFI密钥: " + getByID("wifi-passeord").value.trim() + "成功\r\n"
            } else {
                tip_text += date.toLocaleString('chinese', {hour12: false}) + " websocket未连接。" + "\r\n"
            }
            getByID("tip-textarea").textContent = tip_text
        } catch (e) {
            tip_text += date.toLocaleString('chinese', {hour12: false}) + " " + e + "\r\n"
            getByID("tip-textarea").textContent = tip_text
        }
    }


    getByID("btn-set-dac0").addEventListener("click", onSetDac0);
    getByID("btn-set-dac1").addEventListener("click", onSetDac1);

    function onSetDac0() {
        if (ws.readyState == WebSocket.OPEN) {
            let protocol_header_arr = [];
            protocol_header_arr.push(protocol_header_1.charCodeAt());
            protocol_header_arr.push(protocol_header_2.charCodeAt());
            protocol_header_arr.push(SET_DAC0_VAL.charCodeAt());
            protocol_header_arr.push(Math.round(parseInt(getByID("dac0-val").value, 10) / 3300 * 255, 0));
            let arr = new Uint8Array(protocol_header_arr);
            ws.send(arr);
        }
    }

    function onSetDac1() {
        if (ws.readyState == WebSocket.OPEN) {
            let protocol_header_arr = [];
            protocol_header_arr.push(protocol_header_1.charCodeAt());
            protocol_header_arr.push(protocol_header_2.charCodeAt());
            protocol_header_arr.push(SET_DAC1_VAL.charCodeAt());
            protocol_header_arr.push(Math.round(parseInt(getByID("dac1-val").value, 10) / 3300 * 255, 0));
            let arr = new Uint8Array(protocol_header_arr);
            ws.send(arr);
        }
    }

    getByID("speed-target").addEventListener("change", onSeedTargetChange);

    function onSeedTargetChange(e) {
        let v = parseInt(getByID('speed-target').value, 10);
        if (v > parseInt(getByID("speed-max").value, 10)) {
            v = parseInt(getByID("speed-max").value, 10)
        }
        if (v < parseInt(getByID("speed-min").value, 10)) {
            v = parseInt(getByID("speed-min").value, 10)
        }
        getByID('speed-target').value = v;
        getByID("speedSlider").value = v;
        onConfirm();
    }

    getByID("speedSlider").addEventListener("change", onSpeedSliderChange);

    function onSpeedSliderChange(e) {
        getByID("speed-target").value = getByID("speedSlider").value;
        onSeedTargetChange(null);
    }

    getByID("btn-confirm").addEventListener("click", onConfirm);

    function onConfirm() {
        if (ws.readyState == WebSocket.OPEN) {
            let protocol_header_arr = [];
            protocol_header_arr.push(protocol_header_1.charCodeAt());
            protocol_header_arr.push(protocol_header_2.charCodeAt());
            protocol_header_arr.push(SET_SPEED.charCodeAt());
            protocol_header_arr.push((parseInt(getByID("speed-target").value, 10) >> 8) & 0xff);
            protocol_header_arr.push(parseInt(getByID("speed-target").value, 10) & 0xff);
            let arr = new Uint8Array(protocol_header_arr);
            ws.send(arr);
        }
    }

    getByID("btn-update-cas").addEventListener("click", onUpdateCas)

    function onUpdateCas() {
        if (ws.readyState == WebSocket.OPEN) {
            let protocol_header_arr = [];
            protocol_header_arr.push(protocol_header_1.charCodeAt());
            protocol_header_arr.push(protocol_header_2.charCodeAt());
            protocol_header_arr.push(SET_CAS_MODEL.charCodeAt());
            for (let i = 0; i < signals.option.series[0].data.length; i++) {
                protocol_header_arr.push(signals.option.series[0].data[i]-signals.CAS_LO)
            }
            let arr = new Uint8Array(protocol_header_arr);
            console.log(arr)
            ws.send(arr);
        }
    }

    getByID("btn-update-crs").addEventListener("click", onUpdateCrs)

    function onUpdateCrs() {
        if (ws.readyState == WebSocket.OPEN) {
            let protocol_header_arr = [];
            protocol_header_arr.push(protocol_header_1.charCodeAt());
            protocol_header_arr.push(protocol_header_2.charCodeAt());
            protocol_header_arr.push(SET_CRS_MODEL.charCodeAt());
            for (let i = 0; i < signals.option.series[0].data.length; i++) {
                protocol_header_arr.push(signals.option.series[1].data[i])
            }
            let arr = new Uint8Array(protocol_header_arr);
            console.log(arr)
            ws.send(arr);
        }
    }

    getByID("btn-write-cas").addEventListener("click", onWriteCas)

    function onWriteCas() {
        if (ws.readyState == WebSocket.OPEN) {
            let protocol_header_arr = [];
            protocol_header_arr.push(protocol_header_1.charCodeAt());
            protocol_header_arr.push(protocol_header_2.charCodeAt());
            protocol_header_arr.push(SAVE_CAS_MODEL.charCodeAt());
            for (let i = 0; i < signals.option.series[0].data.length; i++) {
                protocol_header_arr.push(signals.option.series[0].data[i]-signals.CAS_LO)
            }
            let arr = new Uint8Array(protocol_header_arr);
            console.log(arr)
            ws.send(arr);
        }
    }

    getByID("btn-write-crs").addEventListener("click", onWriteCrs)

    function onWriteCrs() {
        if (ws.readyState == WebSocket.OPEN) {
            let protocol_header_arr = [];
            protocol_header_arr.push(protocol_header_1.charCodeAt());
            protocol_header_arr.push(protocol_header_2.charCodeAt());
            protocol_header_arr.push(SAVE_CRS_MODEL.charCodeAt());
            for (let i = 0; i < signals.option.series[0].data.length; i++) {
                protocol_header_arr.push(signals.option.series[1].data[i])
            }
            let arr = new Uint8Array(protocol_header_arr);
            console.log(arr)
            ws.send(arr);
        }
    }

    function showMesAlert(mes) {
        getByID("mes-alert").innerText = mes
    }
})();
