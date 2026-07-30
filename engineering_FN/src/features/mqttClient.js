// import mqtt from 'mqtt';

// // MQTT broker connection options
// const options = {
//     clientId: `mqtt_${Math.random().toString(16).slice(3)}`,
//     keepalive: 30,
//     clean: true,
// };

// // Connect to the MQTT broker
// const client = mqtt.connect('ws://broker.hivemq.com:8000/mqtt', options);

// client.on('connect', () => {
//     console.log('Connected to MQTT broker');
// });

// // Subscribe to a topic
// const subscribe = (topic) => {
//     client.subscribe(topic, (err) => {
//         if (!err) {
//             console.log(`Subscribed to topic: ${topic}`);
//         } else {
//             console.error('Failed to subscribe:', err);
//         }
//     });
// };

// // Handle incoming messages
// client.on('message', (topic, message) => {
//     console.log(`Received message on topic ${topic}:`, message.toString());
// });

// // Publish a message (optional if needed)
// const publish = (topic, message) => {
//     client.publish(topic, message, (err) => {
//         if (err) {
//             console.error('Failed to publish:', err);
//         } else {
//             console.log(`Published message to topic ${topic}: ${message}`);
//         }
//     });
// };

// export { client, subscribe, publish };

