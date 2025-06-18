import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';
const TEST_URL = 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch';

async function testAPI() {
    try {
        console.log('Starting conversation with URL:', TEST_URL);
        
        // Test start-conversation endpoint
        const startResponse = await axios.post(`${API_BASE_URL}/start-conversation`, {
            url: TEST_URL
        });
        
        console.log('Conversation started:', startResponse.data);
        const { threadId } = startResponse.data;
        
        // Wait a moment for the initial processing to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test ask-question endpoint
        console.log('\nAsking question...');
        const questionResponse = await axios.post(`${API_BASE_URL}/ask-question`, {
            threadId,
            question: "What are the main features of the Fetch API?"
        });
        
        console.log('Question answered:', questionResponse.data);
        
        // Test conversation history endpoint
        console.log('\nGetting conversation history...');
        const historyResponse = await axios.get(`${API_BASE_URL}/conversation/${threadId}`);
        console.log('Conversation history:', historyResponse.data);
        
    } catch (error) {
        console.error('\nError occurred:');
        console.error('Message:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        if (error.request) {
            console.error('Request was made but no response received');
        }
    }
}

testAPI(); 