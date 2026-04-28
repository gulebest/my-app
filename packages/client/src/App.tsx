import { MainLayout } from './components/layout/MainLayout';
import { ChatContainer } from './components/layout/ChatContainer';
import { ChatThread } from './components/chat/ChatThread';

function App() {
   return (
      <MainLayout>
         <ChatContainer>
            <ChatThread />
         </ChatContainer>
      </MainLayout>
   );
}

export default App;
