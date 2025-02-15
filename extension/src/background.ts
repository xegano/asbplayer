import TabRegistry, { Asbplayer } from './services/tab-registry';
import ImageCapturer from './services/image-capturer';
import VideoHeartbeatHandler from './handlers/video/video-heartbeat-handler';
import RecordMediaHandler from './handlers/video/record-media-handler';
import RerecordMediaHandler from './handlers/video/rerecord-media-handler';
import StartRecordingMediaHandler from './handlers/video/start-recording-media-handler';
import StopRecordingMediaHandler from './handlers/video/stop-recording-media-handler';
import ToggleSubtitlesHandler from './handlers/video/toggle-subtitles-handler';
import SyncHandler from './handlers/video/sync-handler';
import HttpPostHandler from './handlers/video/http-post-handler';
import VideoToAsbplayerCommandForwardingHandler from './handlers/video/video-to-asbplayer-command-forwarding-handler';
import AsbplayerToVideoCommandForwardingHandler from './handlers/asbplayer/asbplayer-to-video-command-forwarding-handler';
import AsbplayerV2ToVideoCommandForwardingHandler from './handlers/asbplayerv2/asbplayer-v2-to-video-command-forwarding-handler';
import AsbplayerHeartbeatHandler from './handlers/asbplayerv2/asbplayer-heartbeat-handler';
import RefreshSettingsHandler from './handlers/popup/refresh-settings-handler';
import { CommandHandler } from './handlers/command-handler';
import TakeScreenshotHandler from './handlers/video/take-screenshot-handler';
import BackgroundPageManager from './services/background-page-manager';
import BackgroundPageReadyHandler from './handlers/backgroundpage/background-page-ready-handler';
import AudioBase64Handler from './handlers/backgroundpage/audio-base-64-handler';
import AckTabsHandler from './handlers/asbplayerv2/ack-tabs-handler';
import OpenExtensionShortcutsHandler from './handlers/asbplayerv2/open-extension-shortcuts-handler';
import ExtensionCommandsHandler from './handlers/asbplayerv2/extension-commands-handler';
import OpenAsbplayerSettingsHandler from './handlers/video/open-asbplayer-settings-handler';
import CaptureVisibleTabHandler from './handlers/foreground/capture-visible-tab-handler';
import CopyToClipboardHandler from './handlers/video/copy-to-clipboard-handler';
import SettingsUpdatedHandler from './handlers/asbplayerv2/settings-updated-handler';
import {
    Command,
    CopySubtitleMessage,
    ExtensionToVideoCommand,
    Message,
    PostMineAction,
    SettingsProvider,
    TakeScreenshotMessage,
    ToggleRecordingMessage,
    ToggleVideoSelectMessage,
} from '@project/common';
import { primeLocalization } from './services/localization-fetcher';
import VideoDisappearedHandler from './handlers/video/video-disappeared-handler';
import { ExtensionSettingsStorage } from './services/extension-settings-storage';
import LoadSubtitlesHandler from './handlers/asbplayerv2/load-subtitles-handler';
import ToggleSidePanelHandler from './handlers/video/toggle-side-panel-handler';
import CopySubtitleHandler from './handlers/asbplayerv2/copy-subtitle-handler';
import { RequestingActiveTabPermissionHandler } from './handlers/video/requesting-active-tab-permission';
import { CardPublisher } from './services/card-publisher';
import AckMessageHandler from './handlers/video/ack-message-handler';
import PublishCardHandler from './handlers/asbplayerv2/publish-card-handler';

chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });

const settings = new SettingsProvider(new ExtensionSettingsStorage());

const startListener = async () => {
    primeLocalization(await settings.getSingle('language'));
};

chrome.runtime.onInstalled.addListener(startListener);
chrome.runtime.onStartup.addListener(startListener);

const tabRegistry = new TabRegistry(settings);
const backgroundPageManager = new BackgroundPageManager(tabRegistry);
const imageCapturer = new ImageCapturer(settings);
const cardPublisher = new CardPublisher(backgroundPageManager, settings);

const handlers: CommandHandler[] = [
    new VideoHeartbeatHandler(tabRegistry),
    new RecordMediaHandler(backgroundPageManager, imageCapturer, cardPublisher, settings),
    new RerecordMediaHandler(backgroundPageManager, cardPublisher),
    new StartRecordingMediaHandler(backgroundPageManager, imageCapturer, cardPublisher),
    new StopRecordingMediaHandler(backgroundPageManager, imageCapturer, cardPublisher, settings),
    new TakeScreenshotHandler(imageCapturer, cardPublisher),
    new ToggleSubtitlesHandler(settings, tabRegistry),
    new SyncHandler(tabRegistry),
    new HttpPostHandler(),
    new ToggleSidePanelHandler(tabRegistry),
    new OpenAsbplayerSettingsHandler(),
    new CopyToClipboardHandler(),
    new VideoDisappearedHandler(tabRegistry),
    new RequestingActiveTabPermissionHandler(),
    new CopySubtitleHandler(tabRegistry),
    new LoadSubtitlesHandler(tabRegistry),
    new PublishCardHandler(cardPublisher),
    new AckMessageHandler(tabRegistry),
    new VideoToAsbplayerCommandForwardingHandler(tabRegistry),
    new AsbplayerToVideoCommandForwardingHandler(),
    new AsbplayerHeartbeatHandler(tabRegistry),
    new AckTabsHandler(tabRegistry),
    new SettingsUpdatedHandler(tabRegistry, settings),
    new OpenExtensionShortcutsHandler(),
    new ExtensionCommandsHandler(),
    new AsbplayerV2ToVideoCommandForwardingHandler(),
    new RefreshSettingsHandler(tabRegistry),
    new BackgroundPageReadyHandler(backgroundPageManager),
    new AudioBase64Handler(backgroundPageManager),
    new CaptureVisibleTabHandler(),
];

chrome.runtime.onMessage.addListener((request: Command<Message>, sender, sendResponse) => {
    for (const handler of handlers) {
        if (
            (typeof handler.sender === 'string' && handler.sender === request.sender) ||
            (typeof handler.sender === 'object' && handler.sender.includes(request.sender))
        ) {
            if (handler.command === null || handler.command === request.message.command) {
                if (handler.handle(request, sender, sendResponse) === true) {
                    return true;
                }

                break;
            }
        }
    }
});

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'load-subtitles',
        title: chrome.i18n.getMessage('contextMenuLoadSubtitles'),
        contexts: ['page', 'video'],
    });

    chrome.contextMenus.create({
        id: 'mine-subtitle',
        title: chrome.i18n.getMessage('contextMenuMineSubtitle'),
        contexts: ['page', 'video'],
    });
});

chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === 'load-subtitles') {
        const toggleVideoSelectCommand: ExtensionToVideoCommand<ToggleVideoSelectMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'toggle-video-select',
            },
        };
        tabRegistry.publishCommandToVideoElementTabs((tab): ExtensionToVideoCommand<Message> | undefined => {
            if (info.pageUrl !== tab.url) {
                return undefined;
            }

            return toggleVideoSelectCommand;
        });
    } else if (info.menuItemId === 'mine-subtitle') {
        tabRegistry.publishCommandToVideoElements((videoElement): ExtensionToVideoCommand<Message> | undefined => {
            if (info.srcUrl !== undefined && videoElement.src !== info.srcUrl) {
                return undefined;
            }

            if (info.srcUrl === undefined && info.pageUrl !== videoElement.tab.url) {
                return undefined;
            }

            const copySubtitleCommand: ExtensionToVideoCommand<CopySubtitleMessage> = {
                sender: 'asbplayer-extension-to-video',
                message: {
                    command: 'copy-subtitle',
                    postMineAction: PostMineAction.showAnkiDialog,
                },
                src: videoElement.src,
            };
            return copySubtitleCommand;
        });
    }
});

chrome.commands.onCommand.addListener((command) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const validAsbplayer = (asbplayer: Asbplayer) => {
            if (asbplayer.sidePanel) {
                return false;
            }

            const tab = asbplayer.tab;

            if (tab && tabs.find((t) => t.id === tab.id) === undefined) {
                return false;
            }

            return true;
        };

        switch (command) {
            case 'copy-subtitle':
            case 'update-last-card':
            case 'copy-subtitle-with-dialog':
                const postMineAction = postMineActionFromCommand(command);
                tabRegistry.publishCommandToVideoElements((videoElement) => {
                    if (tabs.find((t) => t.id === videoElement.tab.id) === undefined) {
                        return undefined;
                    }

                    const extensionToVideoCommand: ExtensionToVideoCommand<CopySubtitleMessage> = {
                        sender: 'asbplayer-extension-to-video',
                        message: {
                            command: 'copy-subtitle',
                            postMineAction: postMineAction,
                        },
                        src: videoElement.src,
                    };
                    return extensionToVideoCommand;
                });

                tabRegistry.publishCommandToAsbplayers({
                    commandFactory: (asbplayer) => {
                        if (!validAsbplayer(asbplayer)) {
                            return undefined;
                        }

                        const extensionToPlayerCommand: Command<CopySubtitleMessage> = {
                            sender: 'asbplayer-extension-to-player',
                            message: {
                                command: 'copy-subtitle',
                                postMineAction: postMineAction,
                            },
                        };
                        return extensionToPlayerCommand;
                    },
                });
                break;
            case 'toggle-video-select':
                for (const tab of tabs) {
                    if (typeof tab.id !== 'undefined') {
                        const extensionToVideoCommand: ExtensionToVideoCommand<ToggleVideoSelectMessage> = {
                            sender: 'asbplayer-extension-to-video',
                            message: {
                                command: 'toggle-video-select',
                            },
                        };
                        chrome.tabs.sendMessage(tab.id, extensionToVideoCommand);
                    }
                }
                break;
            case 'take-screenshot':
                tabRegistry.publishCommandToVideoElements((videoElement) => {
                    if (tabs.find((t) => t.id === videoElement.tab.id) === undefined) {
                        return undefined;
                    }

                    const extensionToVideoCommand: ExtensionToVideoCommand<TakeScreenshotMessage> = {
                        sender: 'asbplayer-extension-to-video',
                        message: {
                            command: 'take-screenshot',
                        },
                        src: videoElement.src,
                    };
                    return extensionToVideoCommand;
                });

                tabRegistry.publishCommandToAsbplayers({
                    commandFactory: (asbplayer) => {
                        if (!validAsbplayer(asbplayer)) {
                            return undefined;
                        }

                        const extensionToPlayerCommand: Command<TakeScreenshotMessage> = {
                            sender: 'asbplayer-extension-to-player',
                            message: {
                                command: 'take-screenshot',
                            },
                        };
                        return extensionToPlayerCommand;
                    },
                });
                break;
            case 'toggle-recording':
                tabRegistry.publishCommandToVideoElements((videoElement) => {
                    if (tabs.find((t) => t.id === videoElement.tab.id) === undefined) {
                        return undefined;
                    }

                    const extensionToVideoCommand: ExtensionToVideoCommand<ToggleRecordingMessage> = {
                        sender: 'asbplayer-extension-to-video',
                        message: {
                            command: 'toggle-recording',
                        },
                        src: videoElement.src,
                    };
                    return extensionToVideoCommand;
                });
                break;
            default:
                throw new Error('Unknown command ' + command);
        }
    });
});

function postMineActionFromCommand(command: string) {
    switch (command) {
        case 'copy-subtitle':
            return PostMineAction.none;
        case 'copy-subtitle-with-dialog':
            return PostMineAction.showAnkiDialog;
        case 'update-last-card':
            return PostMineAction.updateLastCard;
        default:
            throw new Error('Cannot determine post mine action for unknown command ' + command);
    }
}
