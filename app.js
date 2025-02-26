'use strict';

const Homey = require('homey');

module.exports = class EmporiaVue extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('EmporiaVue has been initialized');
  }

};
