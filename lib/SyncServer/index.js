var uuid = require('node-uuid');
var _ = require('lodash');
var useragent = require('useragent');

var connections = {};
var sockets = {};

module.exports = function() {
    return {
        getListOfConnections: function() {
            return _.map(connections, function(connection, key) {
                return _.clone(connection);
            });
        },
        setSessionName: function(sessionId, name) {
            if(!connections[sessionId]) {
                return;
            }

            connections[sessionId].name = name;

            sockets[sessionId].emit('clientCommand', {
                command: 'setName',
                data: {
                    name: name
                }
            });
        },
        reloadScreen: function(sessionId) {
            sockets[sessionId].emit('clientCommand', {
                command: 'reload'
            });
        },
        identify: function() {
            _.each(sockets, function(socket) {
                socket.emit('clientCommand', {
                    command: 'identify'
                });
            });
        },
        messageAll: function(message) {
            _.each(sockets, function(socket) {
                socket.emit('clientCommand', {
                    command: 'message',
                    data: {
                        message: message
                    }
                });
            });
        },
        start: function(socket, callback) {
            socket.sockets.on('connection', function(socket) {
                var sessionId = uuid.v4();

                sockets[sessionId] = socket;

                var ip = socket.upgradeReq ? socket.upgradeReq.headers['x-real-ip'] || socket.upgradeReq.headers['x-forwarded-for'] || socket.upgradeReq.connection.remoteAddress
                    : socket.handshake.headers['x-real-ip'] || socket.handshake.headers['x-forwarded-for'] || socket.handshake.address.address;

                connections[sessionId] = {
                    name: ip || sessionId,
                    sessionId: sessionId,
                    ip: ip,
                    currentView: {
                        url: 'Unknown',
                        dashboard: 'Unknown',
                        view: 'Unknown'
                    }
                };

                socket.emit('connectionHandshake', {
                    sessionId: sessionId
                });

                socket.on('nameConnection', function(data) {
                    connections[sessionId].name = data.name;
                });

                socket.on('setConnectionProperties', function(properties) {
                    var userAgentString = properties.userAgent;
                    var parsedUserAgent = useragent.parse(userAgentString);

                    properties.userAgent = {
                        os: parsedUserAgent.os.toString(),
                        device: parsedUserAgent.device.toString(),
                        family: parsedUserAgent.family,
                        major: parsedUserAgent.major,
                        minor: parsedUserAgent.minor,
                        full: userAgentString
                    };

                    connections[sessionId].properties = properties;
                });

                socket.on('viewSelected', function(currentView) {
                    connections[sessionId].currentView = currentView;
                });

                socket.on('disconnect', function() {
                    delete connections[sessionId];
                    delete sockets[sessionId];
                });
            });

            callback();
        }
    };
};
