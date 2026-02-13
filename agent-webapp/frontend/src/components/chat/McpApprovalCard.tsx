import React from 'react';
import { Button, Text } from '@fluentui/react-components';
import { CopilotMessage } from '@fluentui-copilot/react-copilot-chat';
import { AgentIcon } from '../core/AgentIcon';
import styles from './McpApprovalCard.module.css';

interface McpApprovalCardProps {
  toolName: string;
  serverLabel: string;
  arguments?: string;
  onApprove: () => void;
  onReject: () => void;
  disabled?: boolean;
  agentName?: string;
  agentLogo?: string;
}

export const McpApprovalCard: React.FC<McpApprovalCardProps> = ({
  toolName,
  serverLabel,
  arguments: args,
  onApprove,
  onReject,
  disabled,
  agentName = 'AI Assistant',
  agentLogo,
}) => {
  return (
    <CopilotMessage
      avatar={<AgentIcon logoUrl={agentLogo} />}
      name={agentName}
      loadingState="none"
      className={styles.message}
    >
      <div className={styles.content}>
        <Text className={styles.title}>
          I need your approval to use an external tool
        </Text>
        
        <div className={styles.details}>
          <div className={styles.detail}>
            <Text weight="semibold">Tool:</Text> <Text>{toolName}</Text>
          </div>
          <div className={styles.detail}>
            <Text weight="semibold">Server:</Text> <Text>{serverLabel}</Text>
          </div>
          {args && (
            <details className={styles.argumentsDisclosure}>
              <summary className={styles.argumentsSummary}>View arguments</summary>
              <pre className={styles.arguments}>{(() => {
                try {
                  return JSON.stringify(JSON.parse(args), null, 2);
                } catch {
                  return args;
                }
              })()}</pre>
            </details>
          )}
        </div>
        
        <div className={styles.actions}>
          <Button 
            appearance="primary"
            onClick={onApprove} 
            disabled={disabled}
          >
            Approve
          </Button>
          <Button 
            appearance="secondary"
            onClick={onReject} 
            disabled={disabled}
          >
            Reject
          </Button>
        </div>
      </div>
    </CopilotMessage>
  );
};
