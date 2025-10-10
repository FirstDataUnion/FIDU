import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
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
 * Enhanced Markdown Component with advanced features
 * 
 * Features:
 * - Syntax highlighting for code blocks
 * - Copy buttons for code blocks
 * - Enhanced tables with better styling
 * - Enhanced links with external link indicators
 * - Enhanced blockquotes with better visual design
 * - Enhanced lists with better spacing
 * - Task lists with checkboxes
 * - Strikethrough text support
 * - Math rendering with KaTeX
 * - GitHub Flavored Markdown (GFM) support
 * - Task lists, strikethrough, math, and more
 */

export interface EnhancedMarkdownProps {
  /** The markdown content to render */
  content: string;
  /** Whether to enable syntax highlighting */
  enableSyntaxHighlighting?: boolean;
  /** Whether to show copy buttons on code blocks */
  showCopyButtons?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Additional sx styles */
  sx?: any;
  /** Whether to preprocess the content */
  preprocess?: boolean;
}

/**
 * Enhanced Code Block Component with copy functionality
 */
const CodeBlock: React.FC<{
  node?: any;
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
  showCopyButton?: boolean;
}> = ({ inline, className, children, showCopyButton = true }) => {
  const [copied, setCopied] = useState(false);
  const theme = useTheme();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(String(children));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  }, [children]);

  if (inline) {
    return (
      <code
        style={{
          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          padding: '2px 4px',
          borderRadius: '4px',
          fontSize: '0.9em',
          fontFamily: 'Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        }}
      >
        {children}
      </code>
    );
  }

  return (
    <Box
      sx={{
        position: 'relative',
        backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5',
        borderRadius: '8px',
        overflow: 'hidden',
        margin: '16px 0',
      }}
    >
      {showCopyButton && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 1,
          }}
        >
          <Tooltip title={copied ? 'Copied!' : 'Copy code'}>
            <IconButton
              size="small"
              onClick={handleCopy}
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: 'text.secondary',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                },
              }}
            >
              {copied ? <CheckIcon fontSize="small" /> : <CopyIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      )}
      <pre
        style={{
          margin: 0,
          padding: '16px',
          overflow: 'auto',
          fontSize: '14px',
          lineHeight: 1.5,
          fontFamily: 'Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        }}
      >
        <code className={className}>{children}</code>
      </pre>
    </Box>
  );
};

/**
 * Enhanced Table Component
 */
const EnhancedTable: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useTheme();
  
  return (
    <Paper
      elevation={1}
      sx={{
        overflow: 'hidden',
        margin: '16px 0',
        border: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Table sx={{ minWidth: 650 }}>
        {children}
      </Table>
    </Paper>
  );
};

/**
 * Enhanced Link Component
 */
const EnhancedLink: React.FC<{ href?: string; children: React.ReactNode }> = ({ href, children }) => {
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
 * Enhanced Blockquote Component
 */
const EnhancedBlockquote: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useTheme();
  
  return (
    <Box
      sx={{
        borderLeft: `4px solid ${theme.palette.primary.main}`,
        paddingLeft: 2,
        margin: '16px 0',
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
        padding: '12px 16px',
        borderRadius: '0 8px 8px 0',
        fontStyle: 'italic',
      }}
    >
      {children}
    </Box>
  );
};

/**
 * Enhanced List Component (currently unused, kept for potential future use)
 */
// const EnhancedList: React.FC<{ children: React.ReactNode; ordered?: boolean }> = ({ children, ordered = false }) => {
//   const Component = ordered ? 'ol' : 'ul';
//   
//   return (
//     <Box
//       component={Component}
//       sx={{
//         marginTop: '8px',
//         marginBottom: '16px',
//         paddingLeft: '20px',
//       }}
//     >
//       {children}
//     </Box>
//   );
// };

/**
 * Task List Item Component
 */
const TaskListItem: React.FC<{ children: React.ReactNode; checked: boolean }> = ({ children, checked }) => {
  return (
    <ListItem sx={{ padding: 0, alignItems: 'flex-start' }}>
      <Checkbox
        checked={checked}
        disabled
        size="small"
        sx={{ marginRight: 1, marginTop: 0.5 }}
      />
      <ListItemText
        primary={children}
        sx={{ 
          '& .MuiListItemText-primary': {
            textDecoration: checked ? 'line-through' : 'none',
            opacity: checked ? 0.7 : 1,
          }
        }}
      />
    </ListItem>
  );
};

/**
 * Strikethrough Component
 */
const Strikethrough: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <span style={{ textDecoration: 'line-through' }}>
      {children}
    </span>
  );
};

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  const textArea = document.createElement('textarea');
  textArea.innerHTML = text;
  return textArea.value;
}

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
          marginTop: '16px',
          marginBottom: '8px',
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
          marginBottom: '6px',
          lineHeight: 1.5,
        },
        '& hr': {
          margin: '12px 0',
          border: 'none',
          borderTop: `1px solid ${theme.palette.divider}`,
        },
        '& pre': {
          margin: '8px 0',
          borderRadius: '8px',
          overflow: 'auto',
        },
        // List styling to reduce spacing
        '& ul, & ol': {
          marginTop: '4px',
          marginBottom: '8px',
          paddingLeft: '20px',
        },
        '& li': {
          marginBottom: '2px',
          lineHeight: 1.4,
        },
        '& li:last-child': {
          marginBottom: 0,
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
          // Use default ReactMarkdown rendering for all content
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
                    
                    // Enhanced lists with tighter spacing
                    ul: ({ children, ...props }) => (
                      <Box component="ul" sx={{ margin: 0, paddingLeft: '20px', '& li': { marginBottom: '1px' } }} {...props}>
                        {children}
                      </Box>
                    ),
                    ol: ({ children, ...props }) => (
                      <Box component="ol" sx={{ margin: 0, paddingLeft: '20px', '& li': { marginBottom: '1px' } }} {...props}>
                        {children}
                      </Box>
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