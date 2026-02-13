import { useState, useRef, useEffect } from 'react';
import {
  ChatInput as ChatInputFluent,
  ImperativeControlPlugin,
  type ImperativeControlPluginRef,
} from '@fluentui-copilot/react-copilot';
import { Button, Toast, ToastTitle, Toaster, useId, useToastController, Text, makeStyles, tokens } from '@fluentui/react-components';
import { Attach24Regular, Settings24Regular, ChatAdd24Regular, Stop24Regular } from '@fluentui/react-icons';
import { FilePreview } from './FilePreview';
import { validateFile, validateFileCount } from '../../utils/fileAttachments';
import styles from './ChatInput.module.css';

const CHAR_WARNING_THRESHOLD = 3000;
const CHAR_DANGER_THRESHOLD = 3500;
const CHAR_MAX_RECOMMENDED = 4000;

const useCharCounterStyles = makeStyles({
  container: {
    display: 'flex',
    justifyContent: 'flex-end',
    paddingRight: tokens.spacingHorizontalM,
    paddingBottom: tokens.spacingVerticalXS,
  },
  text: {
    fontSize: tokens.fontSizeBase200,
  },
  normal: {
    color: tokens.colorNeutralForeground3,
  },
  warning: {
    color: tokens.colorPaletteYellowForeground1,
  },
  danger: {
    color: tokens.colorPaletteDarkOrangeForeground1,
  },
});

interface ChatInputProps {
  onSubmit: (value: string, files?: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
  onOpenSettings?: () => void;
  onNewChat?: () => void;
  hasMessages?: boolean;
  isStreaming?: boolean;
  onCancelStream?: () => void;
}

const focusInput = (containerRef: React.RefObject<HTMLDivElement | null>) => {
  const editableDiv = containerRef.current?.querySelector('[contenteditable="true"]') as HTMLElement;
  if (editableDiv) {
    editableDiv.focus();
  }
};

export const ChatInput: React.FC<ChatInputProps> = ({
  onSubmit,
  disabled = false,
  placeholder = "Type your message...",
  onOpenSettings,
  onNewChat,
  hasMessages = false,
  isStreaming = false,
  onCancelStream,
}) => {
  const guidanceExampleLines = [
    'Platform: LinkedIn',
    'Audience: Business leaders and IT professionals',
    'Goal/Purpose: Announce a new feature in Azure AI targeting enterprise adoption',
    'Tone: Professional, innovative',
    'Key Message(s): Microsoft is launching "X-Feature," a game-changer in AI automation for enterprise customers. It streamlines operations, boosts productivity, and maintains security.',
    'Supporting Details: Azure AI "X-Feature" cuts processing times by 50% while allowing seamless third-party integration for enterprise workflows.',
    'Call to Action (CTA): Learn more and see how it can transform your organization.',
    'Optional Tags: #AzureAI, #EnterpriseInnovation, #Microsoft',
    'Additional Notes: Include language about security and integration benefits.',
  ];

  const [inputText, setInputText] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const controlRef = useRef<ImperativeControlPluginRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  
  const toasterId = useId("toaster");
  const { dispatchToast } = useToastController(toasterId);
  const charCounterId = useId("char-counter");
  const counterStyles = useCharCounterStyles();

  const charCount = inputText.length;
  const showCounter = charCount >= CHAR_WARNING_THRESHOLD;
  
  const getCounterStyle = () => {
    if (charCount >= CHAR_DANGER_THRESHOLD) return counterStyles.danger;
    if (charCount >= CHAR_WARNING_THRESHOLD) return counterStyles.warning;
    return counterStyles.normal;
  };

  // Auto-focus on mount for immediate typing
  useEffect(() => {
    if (!disabled) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => focusInput(inputContainerRef), 100);
      return () => clearTimeout(timer);
    }
  }, []); // Only on mount

  // Restore focus after message is sent (when status changes from disabled back to enabled)
  useEffect(() => {
    if (!disabled && !isStreaming) {
      // Small delay to allow state to settle
      const timer = setTimeout(() => focusInput(inputContainerRef), 50);
      return () => clearTimeout(timer);
    }
  }, [disabled, isStreaming]);

  // Focus input when messages are cleared (new chat button clicked)
  useEffect(() => {
    if (!hasMessages && !disabled) {
      // Delay to ensure state has settled after clearing
      const timer = setTimeout(() => focusInput(inputContainerRef), 100);
      return () => clearTimeout(timer);
    }
  }, [hasMessages, disabled]);

  const handleSubmit = () => {
    if (inputText && inputText.trim() !== "") {
      onSubmit(inputText.trim(), selectedFiles.length > 0 ? selectedFiles : undefined);
      setInputText("");
      setSelectedFiles([]);
      controlRef.current?.setInputText("");
    }
  };

  const handleCancelStream = () => {
    onCancelStream?.();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // Validate file count first
    const countValidation = validateFileCount(files, selectedFiles.length);
    if (!countValidation.valid) {
      dispatchToast(
        <Toast>
          <ToastTitle>{countValidation.error}</ToastTitle>
        </Toast>,
        { intent: 'warning' }
      );
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Validate each file
    const validFiles: File[] = [];
    for (const file of files) {
      const validation = validateFile(file);
      if (!validation.valid) {
        dispatchToast(
          <Toast>
            <ToastTitle>{validation.error}</ToastTitle>
          </Toast>,
          { intent: 'error' }
        );
      } else {
        validFiles.push(file);
      }
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
    
    // Reset input value so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handlePaste = async (event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length === 0) return;

    // Validate file count
    const countValidation = validateFileCount(files, selectedFiles.length);
    if (!countValidation.valid) {
      event.preventDefault();
      dispatchToast(
        <Toast>
          <ToastTitle>{countValidation.error}</ToastTitle>
        </Toast>,
        { intent: 'warning' }
      );
      return;
    }

    // Validate each file
    const validFiles: File[] = [];
    for (const file of files) {
      const validation = validateFile(file);
      if (!validation.valid) {
        dispatchToast(
          <Toast>
            <ToastTitle>{validation.error}</ToastTitle>
          </Toast>,
          { intent: 'error' }
        );
      } else {
        validFiles.push(file);
      }
    }

    if (validFiles.length > 0) {
      event.preventDefault();
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Escape to cancel streaming
    if (event.key === 'Escape' && isStreaming) {
      event.preventDefault();
      handleCancelStream();
    }
  };

  return (
    <>
      <Toaster toasterId={toasterId} position="top-end" />
      <div className={styles.chatInputContainer} onPaste={handlePaste} onKeyDown={handleKeyDown} ref={inputContainerRef}>
        <FilePreview 
          files={selectedFiles}
          onRemove={handleRemoveFile}
          disabled={disabled}
        />
        <div className={styles.inputWrapper}>
        <ChatInputFluent
          aria-label="Chat Input"
          aria-describedby={showCounter ? charCounterId : undefined}
          charactersRemainingMessage={() => ``}
          maxLength={2000}
          disabled={disabled || isStreaming}
          history={true}
          onChange={(_, data) => setInputText(data.value)}
          onSubmit={handleSubmit}
          placeholderValue={placeholder}
        >
          <ImperativeControlPlugin ref={controlRef} />
        </ChatInputFluent>
        {showCounter && (
          <div className={counterStyles.container} id={charCounterId}>
            <Text className={`${counterStyles.text} ${getCounterStyle()}`}>
              {charCount} / {CHAR_MAX_RECOMMENDED} characters (recommended limit)
            </Text>
          </div>
        )}
        <div className={styles.buttonRow}>
          <div className={styles.actionButtons}>
            {onOpenSettings && (
              <Button
                appearance="subtle"
                icon={<Settings24Regular />}
                onClick={onOpenSettings}
                disabled={disabled}
                aria-label="Settings"
              />
            )}
            {onNewChat && (
              <Button
                appearance="subtle"
                icon={<ChatAdd24Regular />}
                onClick={onNewChat}
                disabled={disabled || !hasMessages}
                aria-label="New chat"
              />
            )}
            <Button
              appearance="subtle"
              icon={<Attach24Regular />}
              onClick={handleAttachClick}
              disabled={disabled}
              aria-label="Attach files"
            />
            <Button
              appearance="subtle"
              icon={<Stop24Regular />}
              onClick={handleCancelStream}
              disabled={!isStreaming}
              aria-label="Cancel response"
              className={styles.cancelButton}
            />
          </div>
        </div>
      </div>
      <details className={styles.guidance}>
        <summary>Prompt guidance</summary>
        <div className={styles.guidanceBody}>
          <p className={styles.guidanceIntro}>Use this template for better results:</p>
          <ul className={styles.guidanceList}>
            <li><strong>Platform:</strong> (e.g., Twitter/X, LinkedIn, Instagram, Blog)</li>
            <li><strong>Audience:</strong> (e.g., Developers, IT Pros, General Public, Business leaders)</li>
            <li><strong>Goal/Purpose:</strong> (e.g., Product promotion, Event announcement, Thought leadership, Highlight company culture)</li>
            <li><strong>Tone:</strong> (e.g., Professional, Conversational, Enthusiastic, Inspirational)</li>
            <li><strong>Key Message(s):</strong> (e.g., What do you want the audience to know? A milestone, new feature, insight?)</li>
            <li><strong>Supporting Details:</strong> (e.g., Why is this exciting? Any data, benefits, or context)</li>
            <li><strong>Call to Action (CTA):</strong> (e.g., Learn More | Register Now | Follow Us | Download Here)</li>
            <li><strong>Optional Tags:</strong> (e.g., Hashtags and mentions for social media optimization)</li>
            <li><strong>Additional Notes:</strong> (e.g., Any visuals or tone sensitivities to keep in mind)</li>
          </ul>
          <div className={styles.guidanceExample}>
            <div className={styles.guidanceExampleTitle}>Example</div>
            <div className={styles.guidanceExampleLines}>
              {guidanceExampleLines.map((line) => (
                <div key={line} className={styles.guidanceExampleLine}>{line}</div>
              ))}
            </div>
          </div>
        </div>
      </details>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileSelect}
        accept="image/*,.pdf,.txt,.md,.csv,.json,.html,.xml"
      />
    </div>
    </>
  );
};
