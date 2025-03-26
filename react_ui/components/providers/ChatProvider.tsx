'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { fetchModels, fetchMcpServers } from '@/lib/api';
import { v4 as uuidv4 } from 'uuid';

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { 
    userId, 
    setUserId, 
    setModels, 
    setSelectedModel, 
    setMcpServers 
  } = useStore();

  // Initialize app - load models, servers, and ensure userId exists
  useEffect(() => {
    async function initialize() {
      // Initialize user ID
      if (!userId) {
        // Check if user ID exists in localStorage
        const storedUserId = localStorage.getItem('mcp_chat_user_id');
        if (storedUserId) {
          setUserId(storedUserId);
        } else {
          // Generate new random user ID
          const newUserId = uuidv4().substring(0, 8);
          setUserId(newUserId);
          localStorage.setItem('mcp_chat_user_id', newUserId);
        }
      }
      
      // Load models
      try {
        const modelList = await fetchModels();
        if (modelList && modelList.length > 0) {
          // Convert API response to the format expected by the store
          const mappedModels = modelList.map((model: any) => ({
            modelName: model.model_name || '',
            modelId: model.model_id || ''
          })).filter((model: any) => model.modelName && model.modelId);
          
          setModels(mappedModels);
          
          // If no model is selected yet, select the first one
          if (mappedModels.length > 0) {
            setSelectedModel(mappedModels[0].modelId);
          }
        }
      } catch (error) {
        console.error('Failed to load models:', error);
      }
      
      // Load MCP servers
      try {
        const servers = await fetchMcpServers();
        if (servers && servers.length > 0) {
          setMcpServers(servers);
        }
      } catch (error) {
        console.error('Failed to load MCP servers:', error);
      }
    }
    
    initialize();
  }, [userId, setUserId, setModels, setSelectedModel, setMcpServers]);

  return <>{children}</>;
}
