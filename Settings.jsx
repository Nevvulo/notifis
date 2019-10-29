const { React } = require('powercord/webpack');
const { getModule, getModuleByDisplayName } = require('powercord/webpack');
const { Category } = require('powercord/components/settings');
const { AsyncComponent } = require('powercord/components');

const Checkbox = AsyncComponent.from(getModuleByDisplayName('Checkbox'));

module.exports = class Settings extends React.Component {
  constructor (props) {
    super(props);
    this.get = props.settings.get.bind(props.settings);
    this.state = {};
  }

  async componentDidMount () {
    this.setState({
      getSortedGuilds: (await getModule([ 'getSortedGuilds' ])).getSortedGuilds,
      getPrivateChannelIds: (await getModule([ 'getPrivateChannelIds' ])).getPrivateChannelIds,
      getChannel: (await getModule([ 'getChannel' ])).getChannel,
      getChannels: (await getModule([ 'getChannels' ])).getChannels
    });
  }

  render () {
    if (!this.state.getSortedGuilds) {
      return null;
    }
    const { getSortedGuilds, getPrivateChannelIds, getChannel, getChannels } = this.state;
    const subscribedChannels = this.props.settings.get('subscribedChannels', []);
    const channels = getChannels();
    return (
      <div>
        <Category
          name='Group DMs'
          opened={this.state['dms-opened']}
          onChange={() => this.setState({ 'dms-opened': !this.state['dms-opened'] })}
        >
          {getPrivateChannelIds().map(getChannel).filter(c => c.type === 3).map(c => <Checkbox
            className='notifis-checkbox marginBottom20-32qID7'
            size={16}
            value={subscribedChannels.includes(c.id)}
            onChange={() => this.props.settings.set('subscribedChannels',
              !subscribedChannels.includes(c.id)
                ? [ ...subscribedChannels, c.id ]
                : subscribedChannels.filter(hiddenChannel => hiddenChannel !== c.id))
            }
          >
            <span>{c.name || c.rawRecipients.map(f => f.username).join(', ')}</span>
          </Checkbox>
          )}
        </Category>
        {getSortedGuilds().map(g => g.guilds).flat().map(g =>
          <Category
            name={g.name}
            opened={this.state[`${g.id}-opened`]}
            onChange={() => this.setState({ [`${g.id}-opened`]: !this.state[`${g.id}-opened`] })}
          >
            {Object.values(channels).filter(a => a.guild_id === g.id && a.type === 0).sort((a, b) => a.position - b.position).map(em =>
              <Checkbox
                className='notifis-checkbox marginBottom20-32qID7'
                size={16}
                value={subscribedChannels.includes(em.id)}
                onChange={() => this.props.settings.set('subscribedChannels',
                  !subscribedChannels.includes(em.id)
                    ? [ ...subscribedChannels, em.id ]
                    : subscribedChannels.filter(hiddenChannel => hiddenChannel !== em.id))
                }
              >
                <span>#{em.name}</span>
              </Checkbox>
            )}
          </Category>
        )}
      </div>
    );
  }

  _set (key, value = !this.state[key], defaultValue) {
    if (!value && defaultValue) {
      value = defaultValue;
    }

    this.props.settings.set(key, value);
    if (key === 'subscribedChannels') {
      powercord.pluginManager.get('notifis').trackingChannels = value;
    }
    this.setState({ [key]: value });
  }
};
