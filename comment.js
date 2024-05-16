class SerialP {
    constructor() {
        this.serialPort = null;
        this.writer = null;
        this.reader = -null;
        this.serialReceiveData = [];
        this.serialOpen = false;
        this.serialClose = true;
        this.receiveDataCallBackFuntion = null;
        this.serialConnectCallBackFun = null;
        this.serialDisConnectCallBackFun = null;
        this.receiveTimeOut = 500;
        this.serialTimer = null;
    }

    serialIsSupport() {
        if ("serial" in navigator) {
            return {ok: true, state: "succeed"};
        } else {
            return {ok: false, state: "你的浏览器不支持Web Serial Api。"};
        }
    }

    init(serialConnectCallBackFun, serialDisConnectCallBackFun, receiveDataCallBackFuntion) {
        try {
            navigator.serial.addEventListener("connect", (e) => {
                this.serialConnectEvent();
            });
            navigator.serial.addEventListener("disconnect", (e) => {
                this.serialDisConnetEvent();
            });
            this.receiveDataCallBackFuntion = receiveDataCallBackFuntion;
            this.serialDisConnectCallBackFun = serialDisConnectCallBackFun;
            this.serialConnectCallBackFun = serialConnectCallBackFun;
            return {
                ok: true,
                state: "succeed!",
            };
        } catch (error) {
            return {
                ok: true,
                state: error,
            };
        }
    }

    serialConnectEvent() {
        console.log("connect");
        this.serialConnectCallBackFun();
    }

    serialDisConnetEvent() {
        console.log("disconnect");
        this.serialDisConnectCallBackFun();
    }

    async serialSearch() {
        try {
            let port = await navigator.serial.requestPort();
            this.serialPort?.close();
            await this.serialPort?.forget();
            this.serialPort = port;
            return {
                ok: true,
                state: "succeed!",
            };
        } catch (error) {
            return {
                ok: true,
                state: error,
            };
        }
    }

    async openSerial(obj) {
        let res = {
            ok: true,
            state: "succeed",
        };
        try {
            await this.serialPort.open(obj);
            this.serialOpen = true;
            this.serialClose = false;
            this.readData(res);
            return res;
        } catch (error) {
            return {
                ok: false,
                state: error,
            };
        }
    }

    /**
     * 在某些情况下可能会发生一些非致命的串行端口读错误，如缓冲区溢出、帧错误或奇偶校验错误。
     * 这些是作为异常抛出的，可以通过在检查port.readable的前一个循环之上添加另一个循环来捕获。
     * 这是可行的，因为只要错误是非致命的，一个新的ReadableStream就会自动创建。
     * 如果发生致命错误，如串行设备被删除，则端口。可读的变成了零。
     */
    async readData(res) {
        while (this.serialOpen && this.serialPort.readable) {
            this.reader = this.serialPort.readable.getReader();
            try {
                while (true) {
                    const {value, done} = await this.reader.read();
                    if (done) {
                        break;
                    }
                    this.dataReceived(value);
                }
            } catch (error) {
                res.state = error;
                res.ok = false;
            } finally {
                this.reader.releaseLock();
            }
        }
        await this.serialPort.close();
    }

    /**
     * 只要串行端口是开放的，它就能继续产生数据，
     * 而 read() 所返回的每个数据块中的数据量基本上是任意的，
     * 取决于调用它的时间。
     * 设备和与之通信的代码可以自行决定什么是完整的信息。
     * 例如，设备可能使用 ASCII 格式的文本与主机通信，
     * 每条信息都以换行（或序列"\r\n"）结束。
     */
    dataReceived(data) {
        this.serialReceiveData.push(...data);
        if (this.receiveTimeOut == 0) {
            this.receiveDataCallBackFuntion(this.serialReceiveData, true);
            this.serialReceiveData = [];
            return;
        }
        //清除之前的时钟
        clearTimeout(this.serialTimer);
        let that = this;
        this.serialTimer = setTimeout(() => {
            //时间到后 发送接收到的数据。感觉这个web serial api用法很奇怪。
            that.receiveDataCallBackFuntion(that.serialReceiveData, true);
            that.serialReceiveData = [];
        }, this.receiveTimeOut);
    }

    async closeSerial() {
        try {
            if (this.serialOpen) {
                this.reader?.cancel();
                this.serialClose = true;
                this.serialOpen = false;
                return {
                    ok: true,
                    state: "succeed。",
                };
            } else {
                return {
                    ok: false,
                    state: "设备没有打开！",
                };
            }
        } catch (error) {
            return {
                ok: false,
                state: error,
            };
        }
    }

    async sendHex(hex, addCRLF) {
        try {
            let ff = "";
            if (!(hex.length % 2 == 0)) {
                ff = "0" + hex;
            } else {
                ff = hex;
            }
            const value = ff.replace(/\s+/g, "");
            if (!hex) {
                return {
                    ok: false,
                    state: "发送内容为空",
                };
            }
            if (/^[0-9A-Fa-f]+$/.test(value) && value.length % 2 === 0) {
                let data = [];
                for (let i = 0; i < value.length; i = i + 2) {
                    data.push(parseInt(value.substring(i, i + 2), 16));
                }
                await this.writeData(Uint8Array.from(data), addCRLF);
                return {
                    ok: true,
                    state: "succeed。",
                };
            } else {
                return {
                    ok: false,
                    state: "HEX格式错误:" + hex,
                };
            }
        } catch (error) {
            return {
                ok: false,
                state: error,
            };
        }
    }

    async sendText(text, addCRLF) {
        try {
            let encoder = new TextEncoder();
            this.writeData(encoder.encode(text), addCRLF);
            return {
                ok: true,
                state: "succeed!",
            };
        } catch (error) {
            return {
                ok: false,
                state: error,
            };
        }
    }

    async writeData(data, addCRLF) {
        try {
            this.writer = this.serialPort.writable.getWriter();
            if (addCRLF) {
                data = new Uint8Array([...data, 0x0d, 0x0a]);
            }
            await this.writer.write(data);
            this.writer.releaseLock();
            return {
                ok: true,
                state: "succeed!",
            };
        } catch (error) {
            return {
                ok: false,
                state: error,
            };
        }
    }

    async sendRowArrayData(data, addCRLF) {
        try {
            this.writer = this.serialPort.writable.getWriter();
            if (addCRLF) {
                data = new Uint8Array([...data, 0x0d, 0x0a]);
            }
            await this.writer.write(data);
            this.writer.releaseLock();
            return {
                ok: true,
                state: "succeed!",
            };
        } catch (error) {
            return {
                ok: false,
                state: error,
            };
        }
    }
}

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
                },
                interval: 1,
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
                },
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

    /**
     * 串口通讯程序 Start
     */
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

    let ses = new SerialP();
    if (!ses.serialIsSupport().ok) {
        serial_show_hints(false, "你的浏览器不支持Web Serial API。");
    } else {
        serial_show_hints(true, "welcome!");
    }

    getByID("receive_timeout").value = ses.receiveTimeOut;

    function bindCallBackFun(id, fun) {
        document.getElementById(id).addEventListener("click", (e) => {
            fun(e, this);
        });
    }

    function bindChangeCallBackFun(id, fun) {
        document.getElementById(id).addEventListener("change", (e) => {
            fun(e, this);
        });
    }

    bindCallBackFun("btn_serial_search", searchSerial);

    async function searchSerial(e, that) {
        serial_show_hints(true, "搜索串口...");
        ses = new SerialP();
        let ret = ses.init(serialConnectEvent, serialDisConnectEvent, receiveDataEvent);
        if (!ret.ok) {
            serial_show_hints(false, "串口初始化:" + ret.state);
            return;
        }
        ret = await ses.serialSearch();
        if (!ret.ok) {
            serial_show_hints(false, "搜索串口:" + ret.state);

        } else {
            serial_show_hints(true, "搜索串口:" + ret.state);
        }
    }

    function serialConnectEvent(params) {
        disableSerialConfigEditable(true);
        alert("连接成功！");
    }

    function serialDisConnectEvent(params) {
        disableSerialConfigEditable(false);
        alert("断开连接！");
    }

    bindCallBackFun("btn_serial_connect", connectSerial);

    async function connectSerial(e, that) {
        if (!ses.serialPort) {
            serial_show_hints(false, "未选择串口！");
            return;
        }
        let ret;
        if (ses.serialPort.readable && ses.serialPort.writable) {
            serial_show_hints(true, "正在关闭串口...");
            ret = await ses.closeSerial();
            serial_show_hints(false, "关闭串口：" + ret.state);
            getByID("btn_serial_connect").textContent = "连接串口";
            disableSerialConfigEditable(false);
            getByID("btn_serial_search").disabled = false;
        } else {
            serial_show_hints(false, "连接中...");
            getByID("btn_serial_search").disabled = true;
            ret = await ses.openSerial({
                baudRate: getByID("serial_baud").value,
                dataBits: getByID("serial_data_bit").value,
                stopBits: getByID("serial_stop_bit").value,
                parity: getByID("serial_checksum_bit").value,
                flowControl: getByID("serial_flow_control").value,
                bufferSize: getByID("serial_buffer").value,
            });
            if (!ret.ok) {
                getByID("btn_serial_search").disabled = false;
                disableSerialConfigEditable(false);
                getByID("btn_serial_connect").textContent = "连接串口";
                serial_show_hints(false, "连接:" + ret.state);

            } else {
                getByID("btn_serial_search").disabled = true;
                getByID("btn_serial_connect").textContent = "关闭串口";
                disableSerialConfigEditable(true);
                serial_show_hints(true, "连接：" + ret.state);
            }
        }
    }

    function serial_show_hints(is_connect, tip_text) {
        if (is_connect) {
            document.getElementById("serial_disconnect_icon").hidden = true;
            document.getElementById("serial_connect_icon").hidden = false;
            document.getElementById("serial_connect_status_text").innerHTML = tip_text;
        } else {
            document.getElementById("serial_disconnect_icon").hidden = false;
            document.getElementById("serial_connect_icon").hidden = true;
            document.getElementById("serial_connect_status_text").innerHTML = tip_text;
        }
    }

    function disableSerialConfigEditable(isDisable) {
        if (isDisable) {
            getByID("serial_baud").disabled = true;
            getByID("serial_data_bit").disabled = true;
            getByID("serial_stop_bit").disabled = true;
            getByID("serial_checksum_bit").disabled = true;
            getByID("serial_flow_control").disabled = true;
            getByID("serial_buffer").disabled = true;
        } else {
            getByID("serial_baud").disabled = false;
            getByID("serial_data_bit").disabled = false;
            getByID("serial_stop_bit").disabled = false;
            getByID("serial_checksum_bit").disabled = false;
            getByID("serial_flow_control").disabled = false;
            getByID("serial_buffer").disabled = false;
        }
    }

    //添加日志
    let asciidecoder = new TextDecoder();
    let newmsg = "";

    function receiveDataEvent(data, isReceive = true) {
        if (data.length <= 0) {
            return;
        }
        if (getByID("hex_show_switch").checked == false) {
            let dataHex = "";
            for (const d of data) {
                //转16进制并补0
                dataHex += d.toString(16).toLocaleUpperCase().padStart(2, "0");
            }
            newmsg += dataHex;
            newmsg = newmsg.split('\r\n')[0];
            if (getByID("enable_add_newline").checked) {
                newmsg += "\r\n";
            }
        } else {
            let dataAscii = asciidecoder.decode(Uint8Array.from(data));
            newmsg += dataAscii;
            newmsg = newmsg.split('\r\n')[0];
            if (getByID("enable_add_newline").checked) {
                newmsg += "\r\n";
            }
        }
        //let time = toolOptions.showTime ? formatDate(new Date()) + '&nbsp;' : ''
        getByID("logger_area").value = newmsg;
        if (getByID("auto_loop_switch").checked) {
            getByID("logger_area").scrollTop = getByID("logger_area").scrollHeight;
        }
        getByID("ccc_logger_area").value = newmsg;
        if (getByID("auto_loop_switch").checked) {
            getByID("ccc_logger_area").scrollTop = getByID("ccc_logger_area").scrollHeight;
        }
    }

    bindChangeCallBackFun("receive_timeout", receiveTimeoutEvent);

    function receiveTimeoutEvent(event, that) {
        ses.receiveTimeOut = parseInt( getByID("receive_timeout").value);
    }

    bindCallBackFun("textarea_copy", copyReceiveTextEvent);

    function copyReceiveTextEvent(event, that) {
        let textarea = getByID("logger_area").value;
        navigator.clipboard
            .writeText(textarea)
            .then(() => {
                alert("复制成功！");
            })
            .catch((err) => {
                alert("复制失败！");
            });
    }

    bindCallBackFun("textarea_clear", clearReceiveTextEvent);

    function clearReceiveTextEvent(event, that) {
        getByID("logger_area").value = "";
        ses.serialReceiveData = [];
        newmsg = "";
    }

    bindCallBackFun("serial_send", sendData);

    function sendData(event, that) {
        let text = getByID("send_area").value;
        _send(text);
    }

    function _send(text) {
        if (text.length <= 0) {
            alert("text 长度小于0");
            return;
        }
        if (getByID("checkbox_hex_send").checked == false) {
            if (getByID("auto_increase_step").value > 0) {
                //text += getByID("auto_increase_step").value;
                alert("不支持!")
            }
            if (getByID("checkbox_add_newline").checked) {
                ses.sendHex(text, true);
            } else {
                ses.sendHex(text, false);
            }
        } else {
            if (getByID("checkbox_add_newline").checked) {
                ses.sendText(text, true);
            } else {
                ses.sendText(text, false);
            }
        }
    }

    let serialloopSendTimer = null;
    bindChangeCallBackFun("checkbox_timer_send", sendDataAuto);

    function sendDataAuto(event, that) {
        clearInterval(serialloopSendTimer);
        if (getByID("checkbox_timer_send").checked) {
            serialloopSendTimer = setInterval(() => {
                let text = getByID("send_area").value;
                _send(text);
            }, parseInt(getByID("send_periodic").value));
        }
    }

    let targetSpeedBuffer = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let option2 = {
        xAxis: {
            data: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
        },
        grid: {
            left: 10,
            containLabel: true,
        },
        yAxis: {
            // offset:-20,
        },
        series: [
            {
                data: targetSpeedBuffer,
                type: "line",
                smooth: true,
            },
        ],
    };

    bindCallBackFun("send_target_speed", sendTagetSpeed);
	speedChart = echarts.init(document.getElementById("speed_tender_charts"));
	speedChart.setOption(option2, true);
    async function sendTagetSpeed(event, that) {
        let v = parseInt(getByID("speed_target").value, 10);
        targetSpeedBuffer.push(v);
        v = "4041" + v.toString(16).padStart(4, "0");
        let ret = await ses.sendHex(v, true);
        if (ret.ok) {
            option2.series[0].data = targetSpeedBuffer.slice(-20);
            speedChart.setOption(option2, true);
            speedChart.resize();
        }
    }

    document.getElementById('speedSlider').max = parseInt( document.getElementById('speed_max').value);
    document.getElementById('speedSlider').min = parseInt( document.getElementById('speed_min').value);
    bindChangeCallBackFun("speed_target", set_speed_target);

    function set_speed_target() {
        let max=parseInt( document.getElementById('speed_max').value);
        let min =parseInt( document.getElementById('speed_min').value);
        let value = parseInt(document.getElementById('speed_target').value);
        if (value > max) {
            value = max;
        }
        if (value < min) {
            value = min;
        }
        document.getElementById('speedSlider').value = value;
        document.getElementById('speed_target').value = value;
    }

    let randomEnableSendTimer = null;
    bindChangeCallBackFun("auto_send_enable", autoSendEnableChange);

    function autoSendEnableChange(event, that) {
        clearInterval(randomEnableSendTimer);
        if (getByID("auto_send_enable").checked) {
            randomEnableSendTimer = setInterval(async () => {
                let max =parseInt( document.getElementById('speed_max').value);
                let min =parseInt( document.getElementById('speed_min').value);
                let ts = parseInt(parseInt(getByID("speed_target").value));
                if (getByID("random_enable").checked) {
                    ts = Math.round(Math.random() * (max - min) + min);
                    ts = (ts > max )? max : ts;
                    ts =( ts <= min )? min : ts;
                }
                targetSpeedBuffer.push(ts);
                ts = "4041" + ts.toString(16).padStart(4, "0");
                let ret = await ses.sendHex(ts, true);
                if (ret.ok) {
                    option2.series[0].data = targetSpeedBuffer.slice(-20);
                    speedChart.setOption(option2, true);
                    speedChart.resize();
                }
            }, parseInt(getByID("auto_send_periodic").value));
        }
    }

    /**
     * 正时波形显示程序 Start
     */
    let sig = new Signal();
    sig.init();
    engineChart = echarts.init(document.getElementById("signal_chart"));
    engineChart.setOption(sig.option, true);
    engineChart.on("click", function (params) {
        let ret = sig.option.series[params.seriesIndex];
        if (ret.name == sig.option.series[1].name) {
            if (ret.data[params.dataIndex] == sig.CRS_HI) {
                sig.option.series[1].data[params.dataIndex] = sig.CRS_LO;
            } else {
                sig.option.series[1].data[params.dataIndex] = sig.CRS_HI;
            }

        } else if (ret.name == sig.option.series[0].name) {
            if (ret.data[params.dataIndex] == sig.CAS_HI) {
                sig.option.series[0].data[params.dataIndex] = sig.CAS_LO;
            } else {
                sig.option.series[0].data[params.dataIndex] = sig.CAS_HI;
            }
        }
        engineChart.setOption(sig.option, true);
        engineChart.resize();
    });

    bindCallBackFun("write_cas_info", writeCasInfo);

    function writeCasInfo(event, that) {
        if (!ses.serialOpen) {
            alert("串口没有打开。")
            return
        }
        try {
            let buf = [];
            for (let i = 0; i < 360; i++) {
                buf[i] = sig.option.series[0].data[i] - 2;
            }
            let ret = ses.sendRowArrayData([0x40, 0x42, ...buf], true);
            console.log([0x40, 0x42, ...buf])
            alert("已发送，ESP32芯片重启后生效。");
        } catch (error) {
            alert("写入失败" + error);
        }
    }

    bindCallBackFun("btn_dac0", btn_dac0_change);

    function btn_dac0_change(event, that) {
        if (!ses.serialOpen) {
            alert("串口没有打开。")
            return
        }
        try {
            let buf= [0x40, 0x44,0,0];
            buf[2] = ((parseInt(document.getElementById("dac0_val").value))>>8)&0xff;
            buf[3] = (parseInt(document.getElementById("dac0_val").value))&0xff;
            let ret = ses.sendRowArrayData(buf, true);
            console.log([0x40, 0x46,...buf])

        } catch (error) {
            alert("写入失败" + error);
        }

    }
    bindCallBackFun("btn_dac1", btn_dac1_change);

    function btn_dac1_change(event, that) {
        if (!ses.serialOpen) {
            alert("串口没有打开。")
            return
        }
        try {
            let buf= [0x40, 0x45,0,0];
            buf[2] =( (parseInt(document.getElementById("dac1_val").value))>>8)&0xff;
            buf[3] = (parseInt(document.getElementById("dac1_val").value))&0xff;
            let ret = ses.sendRowArrayData(buf, true);
            console.log([0x40, 0x46,...buf])

        } catch (error) {
            alert("写入失败" + error);
        }
    }

    bindCallBackFun("restart_device", restartDevice);
        function restartDevice(event, that) {
        if (!ses.serialOpen) {
            alert("串口没有打开。")
            return
        }
        try {
            let ret = ses.sendRowArrayData([0x40, 0x46], true);
            console.log([0x40, 0x46])
            alert("已发送，ESP32芯片重启后生效。");
        } catch (error) {
            alert("写入失败" + error);
        }

    }

    bindCallBackFun("write_crs_info", writeCrsInfo);

    function writeCrsInfo(event, that) {
        if (!ses.serialOpen) {
            alert("串口没有打开。")
            return
        }
        try {
            let buf = [];
            for (let i = 0; i < 360; i++) {
                buf[i] = sig.option.series[1].data[i] - 0;
            }
            let ret = ses.sendRowArrayData([0x40, 0x43, ...buf], true);
            console.log([0x40, 0x42, ...buf])
            alert("已发送，ESP32芯片重启后生效。");
        } catch (error) {
            alert("写入失败" + error);
        }
    }

    bindCallBackFun("phase_click", phaseEntryEvent);

    function phaseEntryEvent(event, that) {
        setTimeout(function () {
            engineChart.resize();
        }, 200);
    }


    window.addEventListener("resize", function () {
        // 改变图表尺寸，在容器大小发生改变时需要手动调用
        speedChart.resize();
    });

    bindChangeCallBackFun("f_upload", fileUpload);

    function fileUpload(event, that) {
        let reader = new FileReader();
        let fileList = document.getElementById("f_upload").files;
        reader.readAsText(fileList[0], "UTF-8");
        reader.onload = function (e) {
            let ss = JSON.parse(e.target.result);
            sig.option.series[0].data = ss[0];
            sig.option.series[1].data = ss[1];
            engineChart.setOption(sig.option, true);
            engineChart.resize();
        };
    }

    bindCallBackFun("save_config", saveConfig);

    function saveConfig(event, that) {
        var elementA = document.createElement("a");
        elementA.download = "json相位配置文件" + new Date(Date.now()).toLocaleDateString("zh-CN", {hour12: false}) + ".json";
        elementA.style.display = "none";
        let sa = [sig.casSignalNum, sig.crsSignalNum];
        let str = JSON.stringify(sa);
        var blob = new Blob([str], {
            type: "application/json",
        });
        elementA.href = URL.createObjectURL(blob);
        document.body.appendChild(elementA);
        elementA.click();
        document.body.removeChild(elementA);
    }
})();
