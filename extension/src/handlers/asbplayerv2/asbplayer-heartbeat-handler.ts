import { AsbplayerHeartbeatMessage, Command, Message } from '@project/common';
import TabRegistry from '../../services/tab-registry';

export default class AsbplayerHeartbeatHandler {
    private readonly tabRegistry: TabRegistry;

    constructor(tabRegistry: TabRegistry) {
        this.tabRegistry = tabRegistry;
    }

    get sender() {
        return 'asbplayerv2';
    }

    get command() {
        return 'heartbeat';
    }

    handle(command: Command<Message>, sender: chrome.runtime.MessageSender) {
        const message = command.message as AsbplayerHeartbeatMessage;
        this.tabRegistry.onAsbplayerHeartbeat(
            sender.tab,
            message.id,
            message.videoPlayer,
            message.sidePanel ?? false,
            message.receivedTabs
        );
        return false;
    }
}
