'use strict';

const Homey = require('homey');
const EmporiaView = require("emporiavue");

const INTERVAL = 60 * 1000; // 1 minutes

module.exports = class VueOutletDriver extends Homey.Driver {

    /**
     * onInit is called when the driver is initialized.
     */
    async onInit() {
        this.log('VueOutletDriver has been initialized');
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
            const devs = [];
            devices.forEach(d => {
                if (d.type === "outlet") {
                    devs.push({
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
        this.log('VueOutletDriver has deviceStarted');
        if (!this.api) {
            try {
                this.log('VueOutletDriver has started api');
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
        this.log("VueOutletDriver has deviceStopped");
        const devices = this.getDevices();
        if (!devices.length) {
            this.setInterval();
            this.api = null;
        }
    }

    async setOutlet(device, on) {
        this.log("VueOutletDriver setOutlet");
        const data = device.getData();
        await this.api.updateOutletState({
            dgid: data.dgid,
            on: on
        });
    }

    async update() {
        this.log("VueOutletDriver update");
        const devices = this.getDevices();
        if (this.api && devices.length) {
            this.log("VueOutletDriver calling getDeviceTimedUsage");
            const devmap = devices.map(device => {
                const data = device.getData();
                return {
                    type: "outlet",
                    name: data.name,
                    dgid: data.dgid,
                    channel: data.channel
                }
            });
            const usage = await this.api.getDeviceTimedUsage("1MIN", devmap);
            await this.api.getOutletState(devmap);
            for (let i = 0; i < devices.length; i++) {
                const used = usage[i].usage;
                if (typeof(used) === "number") {
                    devices[i].updateUsage(used * 60 * 1000).catch(this.log);
                }
                devices[i].updateOn(devmap[i].on).catch(this.log);
            }
        }
    }

};
