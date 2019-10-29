const { resolve } = require('path');
const { Plugin } = require('powercord/entities');
const { getOwnerInstance, waitFor, sleep } = require('powercord/util');
const { inject, uninject } = require('powercord/injector');
const { React, getModule, Flux, getModuleByDisplayName, constants: { Routes } } = require('powercord/webpack');
const Settings = require('./Settings');

module.exports = class TitleBarNotifs extends Plugin {
  async startPlugin () {
    if (process.platform !== 'win32') {
      return this.warn('Exiting due to unsupported platform.');
    }

    this.registerSettings(
      'notifis',
      'Notifis',
      () =>
        React.createElement(Settings, {
          settings: this.settings
        })
    );

    this.loadCSS(resolve(__dirname, 'style.scss'));
    this.titleBarClass = await getModule([ 'titleBar' ]);
    this.icon = await getModuleByDisplayName('Icon');
    this.trackingChannels = this.settings.get('subscribedChannels', []);
    this.notifications = {};
    this.titleBar = await waitFor(`.${this.titleBarClass.titleBar.replace(/ /g, '.')}`);

    for (const cid of this.trackingChannels) {
      this.notifications[cid] = [];
    }

    const { getCurrentUser } = await getModule([ 'getCurrentUser' ]);
    const getSelectedChannelState = await getModule([ 'getSelectedChannelState' ]);

    this.titleBarInstance = getOwnerInstance(this.titleBar);

    Flux.connectStores(
      [ getSelectedChannelState ],
      (id) => (id)
    )(this.acknowledge);

    const mdl = await getModule([ 'shouldNotify' ]);
    inject('tbn-shouldNotify', mdl, 'shouldNotify', (args, res) => {
      const self = getCurrentUser();
      const message = args[0];
      if ((this.trackingChannels.indexOf(message.guild_id) !== -1 || this.trackingChannels.indexOf(message.channel_id) !== -1)) {
        if (self.id === message.author.id) {
          this.notifications[message.channel_id] = [];
        } else {
          this.notifications[message.channel_id].push(message);
        }
        this.titleBarInstance.forceUpdate();
      }
      return res;
    });

    this.patchTitlebar();
  }

  pluginWillUnload () {
    uninject('titlebarnotifs');
    const bar = document.querySelector('.tbn-notification');
    if (bar) {
      bar.remove();
    }
  }

  randomInArray (arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  acknowledge (id = null) {
    if (id === 'all') {
      for (const cid of this.trackingChannels) {
        this.notifications[cid] = [];
      }
      return;
    }
    if (this.notifications[id]) {
      this.notifications[id] = [];
    } else {
      throw new Error('Attempt to acknowledge invalid notification channel');
    }
  }

  getUnreadChannels () {
    return Object.keys(this.notifications).filter(a => this.notifications[a].length > 0);
  }

  async patchTitlebar () {
    const { getChannel } = await getModule([ 'getChannel' ]);
    const { transitionTo } = await getModule([ 'transitionTo' ]);

    let _this = this;
    let currentLoopIndex = 0;

    const delimit = (arr) => arr.slice(0, -2).join(', ') + (arr.slice(0, -2).length ? ', ' : '') + arr.slice(-2).join(' and ');
    const DirectTitleBarComponent = _this.titleBarInstance._reactInternalFiber.child.child.type;
    const TitleBarComponent = class PatchedTitleBarComponent extends React.Component {
      render () {
        const currentChannelID = _this.getUnreadChannels()[currentLoopIndex];
        const channel = getChannel(currentChannelID);
        const channelNotifications = _this.notifications[currentChannelID];
        const directTitleBar = new DirectTitleBarComponent({});

        if (channelNotifications && channelNotifications.length) {
          const uniqueUsers = [ ...new Set(channelNotifications.map(n => n.author.username)) ];
          directTitleBar.props.children.splice(1, 0,
            React.createElement('div', {
              className: 'tbn-notification fly-in'
            }, [
              React.createElement(_this.icon, { style: { marginRight: '4px' },
                name: 'RichActivity' }),
              [
                React.createElement('span', {
                  className: 'wrapperHover-1GktnT wrapper-3WhCwL',
                  // eslint-disable-next-line new-cap
                  onClick: () => transitionTo(Routes.CHANNEL('@me', currentChannelID)),
                  role: 'button'
                }, channel.type === 3 ? channel.name : `#${channel.name}`),
                ` — ${channelNotifications.length} new message${channelNotifications.length === 1 ? '' : 's'} from ${
                  delimit([ ...uniqueUsers.slice(0, 2),
                    uniqueUsers.length - 2 > 0 ? `${uniqueUsers.length - 2} other user${uniqueUsers.length - 2 === 1 ? '' : 's'}` : null ].filter(Boolean))}`
              ]
            ])
          );
        }

        return directTitleBar;
      }
    };

    inject('tbn-titlebarnotifs', _this.titleBarInstance, 'render', () =>
      React.createElement(TitleBarComponent)
    );

    // eslint-disable-next-line
    // re-render titlebar after discord updates with games
    // @todo automatic
    await sleep(2500);
    setInterval(() => {
      _this = this;
      currentLoopIndex++;
      if (currentLoopIndex + 1 > _this.getUnreadChannels().length) {
        currentLoopIndex = 0;
      }
      _this.titleBarInstance.forceUpdate();
    }, 5000);
  }
};
