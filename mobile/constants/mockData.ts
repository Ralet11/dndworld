export const MOCK_TIMELINE = [
    {
        id: '1',
        type: 'SCENE',
        title: 'The Whispering Swamp',
        content: 'You stand at the edge of the marshes. The fog is thick and tastes of sulfur. A distant bell tolls, sending shivers down your spine.',
        timestamp: new Date().toISOString(),
        metadata: {
            image_url: 'https://images.unsplash.com/photo-1502472584811-0a2f2ca7cc9d?q=80&w=2600&auto=format&fit=crop',
            weather: 'Foggy'
        }
    },
    {
        id: 'msg_1',
        type: 'CHAT',
        mode: 'SAY',
        author: 'Garrick (Fighter)',
        text: 'I don\'t like this place. It smells of dead magic.',
        isSelf: false,
    },
    {
        id: 'msg_2',
        type: 'CHAT',
        mode: 'THINK',
        author: 'Ramir (Rogue)',
        text: 'He is right, but the gold is here somewhere. I can feel it.',
        isSelf: true,
    },
    {
        id: 'msg_3',
        type: 'CHAT',
        mode: 'DO',
        author: 'Ramir (Rogue)',
        text: 'steps carefully onto the rotting wooden bridge, testing the weight.',
        isSelf: true,
        status: 'APPROVED'
    },
    {
        id: 'msg_3b',
        type: 'CHAT',
        mode: 'DO',
        author: 'Ramir (Rogue)',
        text: 'tries to pick the lock of the ancient chest.',
        isSelf: true,
        status: 'PENDING'
    },
    {
        id: 'msg_4',
        type: 'SYSTEM',
        content: 'The bridge creaks ominously, but seems stable for now.',
        timestamp: new Date().toISOString(),
    },
];
