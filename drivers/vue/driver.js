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
            this.interval = this.homey.setInterval(() => this.update(), interval);
        }
    }

    async deviceStarted(device) {
        this.log('VueDriver has deviceStarted');
        const settings = device.getSettings();
        if (this.username != settings.username || this.password != settings.password) {
            this.api = null;
            this.username = settings.username;
            this.password = settings.password;
            this.setInterval();
            this.log('VueDriver has started api');
            this.api = await EmporiaView(this.username, this.password);
            this.setInterval(INTERVAL);
            // Update the settings in all the other devices
            const devices = this.getDevices();
            for (let i = 0; i < devices.length; i++) {
                devices[i].setSettings(settings);
            }
        }
        await this.update();
    }

    async deviceStopped(device) {
        this.log("VueDriver has deviceStopped");
        const devices = this.getDevices();
        if (!devices.length) {
            this.setInterval();
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
