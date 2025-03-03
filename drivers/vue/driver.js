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
    }

    async onPair(session) {
        let username;
        let password;
        let devices;
        session.setHandler("login", async (data) => {
            try {
                const api = await EmporiaView(data.username, data.password);
                devices = await api.getDevices();
                username = data.username;
                password = data.password;
                this.log("Auth success");
                return true;
            }
            catch (e) {
                this.log("Auth failed", e);
                return false;
            }
        });
        session.setHandler("list_devices", async () => {
            return devices.map(d => {
                return {
                    name: d.name,
                    data: {
                        name: d.name,
                        dgid: d.dgid,
                        channel: d.channel
                    },
                    settings: {
                        username: username,
                        password: password
                    }
                }
            });
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
                    devices[i].updateUsage(used * 60 * 1000).catch(this.error);
                }
            }
        }
    }

};
