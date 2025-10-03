import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Box,
  IconButton,
  Tooltip,
  useTheme,
  Typography,
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Divider,
  Checkbox,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { preprocessMarkdown } from '../../utils/markdownPreprocessor';
import 'katex/dist/katex.min.css';

/**
 * Decode HTML entities in text
 */
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

/**
 * Enhanced Markdown Renderer Component
 * 
 * Provides intelligent markdown rendering with:
 * - Smart preprocessing to fix common AI-generated formatting issues
 * - Syntax highlighting for code blocks
 * - Copy-to-clipboard functionality
 * - Responsive design
 * - Accessibility features
 * - Task lists, strikethrough, math, and more
 */

export interface EnhancedMarkdownProps {
  /** The markdown content to render */
  content: string;
  /** Whether to enable syntax highlighting */
  enableSyntaxHighlighting?: boolean;
  /** Whether to show copy buttons for code blocks */
  showCopyButtons?: boolean;
  /** Custom CSS classes */
  className?: string;
  /** Additional styling */
  sx?: any;
  /** Whether to preprocess the content */
  preprocess?: boolean;
}

/**
 * Copy button component for code blocks
 */
const CopyButton: React.FC<{ 
  content: string; 
  size?: 'small' | 'medium';
}> = ({ content, size = 'small' }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  }, [content]);
  
  return (
    <Tooltip title={copied ? 'Copied!' : 'Copy code'}>
      <IconButton
        size={size}
        onClick={handleCopy}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
          },
        }}
      >
        {copied ? <CheckIcon fontSize="small" /> : <CopyIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
};

/**
 * Enhanced code block component with syntax highlighting and copy functionality
 */
const CodeBlock: React.FC<{
  node?: any;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  showCopyButton?: boolean;
}> = ({ node: _node, inline, className, children, showCopyButton = true }) => {
  const theme = useTheme();
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeContent = String(children).replace(/\n$/, '');
  
  if (!inline && match) {
    return (
      <Box sx={{ position: 'relative', margin: '16px 0' }}>
        {showCopyButton && <CopyButton content={codeContent} />}
        <SyntaxHighlighter
          style={theme.palette.mode === 'dark' ? oneDark : oneLight}
          language={language}
          PreTag="div"
          customStyle={{
            margin: 0,
            borderRadius: '8px',
            fontSize: '0.875rem',
            lineHeight: 1.5,
          }}
        >
          {codeContent}
        </SyntaxHighlighter>
      </Box>
    );
  }
  
  return (
    <code
      className={className}
      style={{
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        padding: '2px 4px',
        borderRadius: '4px',
        fontSize: '0.875em',
        fontFamily: 'Monaco, Consolas, "Courier New", monospace',
      }}
    >
      {children}
    </code>
  );
};

/**
 * Enhanced table component with better styling
 */
const EnhancedTable: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useTheme();
  
  return (
    <Paper 
      elevation={1} 
      sx={{ 
        margin: '16px 0', 
        overflow: 'hidden',
        border: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Table size="small">
        {children}
      </Table>
    </Paper>
  );
};

/**
 * Enhanced link component with external link indicators
 */
const EnhancedLink: React.FC<{
  href?: string;
  children: React.ReactNode;
}> = ({ href, children }) => {
  const isExternal = href?.startsWith('http');
  
  return (
    <Link
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        textDecoration: 'none',
        '&:hover': {
          textDecoration: 'underline',
        },
      }}
    >
      {children}
      {isExternal && <OpenInNewIcon fontSize="small" />}
    </Link>
  );
};

/**
 * Enhanced blockquote component
 */
const EnhancedBlockquote: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useTheme();
  
  return (
    <Box
      sx={{
        borderLeft: `4px solid ${theme.palette.primary.main}`,
        paddingLeft: 2,
        margin: '16px 0',
        backgroundColor: theme.palette.mode === 'dark' 
          ? 'rgba(255, 255, 255, 0.05)' 
          : 'rgba(0, 0, 0, 0.05)',
        padding: 2,
        borderRadius: '0 8px 8px 0',
        fontStyle: 'italic',
      }}
    >
      {children}
    </Box>
  );
};

/**
 * Enhanced list components with task list support
 */
const EnhancedList: React.FC<{ 
  children: React.ReactNode;
  ordered?: boolean;
}> = ({ children, ordered = false }) => {
  const Component = ordered ? 'ol' : 'ul';
  
  return (
    <Box
      component={Component}
      sx={{
        margin: '16px 0',
        paddingLeft: 3,
        '& li': {
          marginBottom: '8px',
          lineHeight: 1.6,
        },
      }}
    >
      {children}
    </Box>
  );
};

/**
 * Task list item component
 */
const TaskListItem: React.FC<{
  checked?: boolean;
  children: React.ReactNode;
}> = ({ checked = false, children }) => {
  return (
    <ListItem sx={{ paddingLeft: 0, paddingRight: 0 }}>
      <Checkbox 
        checked={checked} 
        disabled 
        size="small"
        sx={{ marginRight: 1, padding: 0 }}
      />
      <ListItemText 
        primary={children}
        sx={{ 
          textDecoration: checked ? 'line-through' : 'none',
          opacity: checked ? 0.7 : 1,
        }}
      />
    </ListItem>
  );
};

/**
 * Strikethrough text component
 */
const Strikethrough: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <span style={{ textDecoration: 'line-through' }}>
      {children}
    </span>
  );
};

/**
 * Main Enhanced Markdown Component
 */
export const EnhancedMarkdown: React.FC<EnhancedMarkdownProps> = ({
  content,
  enableSyntaxHighlighting: _enableSyntaxHighlighting = true,
  showCopyButtons = true,
  className,
  sx,
  preprocess = true,
}) => {
  const theme = useTheme();
  
  // Decode HTML entities first
  const decodedContent = content ? decodeHtmlEntities(content) : '';
  
  // Preprocess the content if enabled
  const processedContent = preprocess ? preprocessMarkdown(decodedContent) : decodedContent;
  
  return (
    <Box
      className={className}
      sx={{
        '& h1, & h2, & h3, & h4, & h5, & h6': {
          marginTop: '24px',
          marginBottom: '16px',
          fontWeight: 600,
          lineHeight: 1.25,
        },
        '& h1': {
          fontSize: '1.875rem',
          borderBottom: `1px solid ${theme.palette.divider}`,
          paddingBottom: '8px',
        },
        '& h2': {
          fontSize: '1.5rem',
        },
        '& h3': {
          fontSize: '1.25rem',
        },
        '& h4': {
          fontSize: '1.125rem',
        },
        '& h5, & h6': {
          fontSize: '1rem',
        },
        '& p': {
          marginBottom: '16px',
          lineHeight: 1.6,
        },
        '& hr': {
          margin: '24px 0',
          border: 'none',
          borderTop: `1px solid ${theme.palette.divider}`,
        },
        '& pre': {
          margin: '16px 0',
          borderRadius: '8px',
          overflow: 'auto',
        },
        // Math styling
        '& .katex': {
          fontSize: '1.1em',
        },
        ...sx,
      }}
    >
      {(() => {
        try {
          return (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex, rehypeRaw]}
              components={{
                // Code blocks with syntax highlighting
                code: ({ node, inline, className, children, ...props }: any) => (
                  <CodeBlock
                    node={node}
                    inline={inline}
                    className={className}
                    showCopyButton={showCopyButtons && !inline}
                    {...props}
                  >
                    {children}
                  </CodeBlock>
                ),
                
                // Enhanced tables
                table: ({ children, ...props }) => (
                  <EnhancedTable {...props}>
                    {children}
                  </EnhancedTable>
                ),
                thead: ({ children, ...props }) => (
                  <TableHead {...props}>
                    {children}
                  </TableHead>
                ),
                tbody: ({ children, ...props }) => (
                  <TableBody {...props}>
                    {children}
                  </TableBody>
                ),
                tr: ({ children, ...props }) => (
                  <TableRow {...props}>
                    {children}
                  </TableRow>
                ),
                th: ({ children, ...props }) => (
                  <TableCell {...props} component="th" sx={{ fontWeight: 600 }} align="left">
                    {children}
                  </TableCell>
                ),
                td: ({ children, ...props }) => (
                  <TableCell {...props} align="left">
                    {children}
                  </TableCell>
                ),
                
                // Enhanced links
                a: ({ href, children, ...props }) => (
                  <EnhancedLink href={href} {...props}>
                    {children}
                  </EnhancedLink>
                ),
                
                // Enhanced blockquotes
                blockquote: ({ children, ...props }) => (
                  <EnhancedBlockquote {...props}>
                    {children}
                  </EnhancedBlockquote>
                ),
                
                // Enhanced lists
                ul: ({ children, ...props }) => (
                  <EnhancedList {...props}>
                    {children}
                  </EnhancedList>
                ),
                ol: ({ children, ...props }) => (
                  <EnhancedList ordered {...props}>
                    {children}
                  </EnhancedList>
                ),
                
                // Task list items
                li: ({ children, ...props }: any) => {
                  // Check if this is a task list item
                  const text = String(children);
                  if (text.includes('[x]') || text.includes('[ ]')) {
                    const checked = text.includes('[x]');
                    const cleanText = text.replace(/^\s*\[[x ]\]\s*/, '');
                    return (
                      <TaskListItem checked={checked}>
                        {cleanText}
                      </TaskListItem>
                    );
                  }
                  return <li {...props}>{children}</li>;
                },
                
                // Strikethrough
                del: ({ children, ...props }) => (
                  <Strikethrough {...props}>
                    {children}
                  </Strikethrough>
                ),
                
                // Horizontal rules
                hr: ({ ...props }) => <Divider {...props} />,
              }}
            >
              {processedContent}
            </ReactMarkdown>
          );
        } catch (error) {
          console.error('Error rendering markdown:', error);
          return (
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
              {processedContent}
            </Typography>
          );
        }
      })()}
    </Box>
  );
};

export default EnhancedMarkdown;