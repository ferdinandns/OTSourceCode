const mqtt = require('mqtt');

// Connect to MQTT broker
const client = mqtt.connect('mqtt://broker.hivemq.com');

client.on('connect', () => {
    console.log('Connected to MQTT broker');
    client.subscribe('my/test/topic');
});

client.on('message', (topic, message) => {
    console.log(`Received message: ${message.toString()} on topic: ${topic}`);
});

module.exports = client;
