'use strict';

const Homey = require('homey');
const EmporiaView = require("emporiavue");

const INTERVAL = 60 * 1000; // 1 minutes

module.exports = class VueDriver extends Homey.Driver {

    /**
     * onInit is called when the driver is initialized.
     */
    async onInit() {
        this.log('VueDriver has been initialized');
        this.api = null;
        this.username = null;
        this.password = null;
    }

    async onPair(session) {
        this.log("VueDriver onPair");
        let devices;
        session.setHandler("start", async (data) => {
            if (!this.api) {
                await session.showView("login_credentials");
            }
            else {
                devices = await this.api.getDevices();
                await session.showView("list_devices");
            }
        });
        session.setHandler("login", async (data) => {
            try {
                const api = await EmporiaView(data.username, data.password);
                devices = await api.getDevices();
                this.username = data.username;
                this.password = data.password;
                this.log("Auth success");
                return true;
            }
            catch (e) {
                this.log("Auth failed", e);
                return false;
            }
        });
        session.setHandler("list_devices", async () => {
            const devs = [];
            devices.forEach(d => {
                if (d.type === "monitor") {
                    devs.push({
                        name: d.name,
                        data: {
                            name: d.name,
                            dgid: d.dgid,
                            channel: d.channel
                        },
                        settings: {
                            username: this.username,
                            password: this.password
                        }
                    });
                }
            });
            return devs;
        });
    }

    setInterval(interval) {
        this.homey.clearInterval(this.interval);
        if (interval) {
            this.interval = this.homey.setInterval(() => this.update().catch(this.log), interval);
        }
    }

    async deviceStarted(device) {
        this.log('VueDriver has deviceStarted');
        if (!this.api) {
            try {
                this.log('VueDriver has started api');
                const settings = device.getSettings();
                this.api = await EmporiaView(settings.username, settings.password);
                this.username = settings.username;
                this.password = settings.password;
                this.setInterval(INTERVAL);
            }
            catch (e) {
                this.log(e);
                return false;
            }
        }
        this.update().catch(this.log);
    }

    async deviceStopped(device) {
        this.log("VueDriver has deviceStopped");
        const devices = this.getDevices();
        if (!devices.length) {
            this.setInterval();
            this.api = null;
        }
    }

    async update() {
        this.log("VueDriver update");
        const devices = this.getDevices();
        if (this.api && devices.length) {
            this.log("VueDriver calling getDeviceTimedUsage");
            const usage = await this.api.getDeviceTimedUsage("1MIN", devices.map(device => {
                const data = device.getData();
                return {
                    name: data.name,
                    dgid: data.dgid,
                    channel: data.channel
                }
            }));
            for (let i = 0; i < devices.length; i++) {
                const used = usage[i].usage;
                if (typeof(used) === "number") {
                    devices[i].updateUsage(used * 60 * 1000).catch(this.log);
                }
            }
        }
    }

};
