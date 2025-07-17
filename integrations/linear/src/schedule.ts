/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';

interface LinearActivityCreateParams {
  text: string;
  sourceURL: string;
}

interface LinearSettings {
  lastIssuesSync?: string;
  lastCommentsSync?: string;
  lastUserActionsSync?: string;
}

/**
 * Creates an activity message based on Linear data
 */
function createActivityMessage(params: LinearActivityCreateParams) {
  return {
    type: 'activity',
    data: {
      text: params.text,
      sourceURL: params.sourceURL,
    },
  };
}

/**
 * Fetches user information from Linear
 */
async function fetchUserInfo(accessToken: string) {
  try {
    const query = `
      query {
        viewer {
          id
          name
          email
        }
      }
    `;

    const response = await axios.post(
      'https://api.linear.app/graphql',
      { query },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: accessToken,
        },
      },
    );

    return response.data.data.viewer;
  } catch (error) {
    throw error;
  }
}

/**
 * Fetches recent issues relevant to the user (created, assigned, or subscribed)
 */
async function fetchRecentIssues(accessToken: string, lastSyncTime: string) {
  try {
    const query = `
      query RecentIssues($lastSyncTime: DateTimeOrDuration) {
        issues(
          filter: {
            updatedAt: { gt: $lastSyncTime }
          },
          first: 50,
          orderBy: updatedAt
        ) {
          nodes {
            id
            identifier
            title
            url
            createdAt
            updatedAt
            state {
              id
              name
              type
            }
            team {
              id
              name
            }
            assignee {
              id
              name
              displayName
            }
            creator {
              id
              name
              displayName
            }
            subscribers {
              nodes {
                id
                name
                displayName
              }
            }
            priority
            history {
              nodes {
                id
                createdAt
                updatedAt
                fromStateId
                toStateId
                fromAssigneeId
                toAssigneeId
                fromPriority
                toPriority
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const response = await axios.post(
      'https://api.linear.app/graphql',
      {
        query,
        variables: {
          lastSyncTime,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: accessToken,
        },
      },
    );

    return response.data.data.issues;
  } catch (error) {
    throw error;
  }
}

/**
 * Fetches recent comments on issues relevant to the user
 */
async function fetchRecentComments(accessToken: string, lastSyncTime: string) {
  try {
    const query = `
      query RecentComments($lastSyncTime: DateTimeOrDuration) {
        comments(
          filter: {
            updatedAt: { gt: $lastSyncTime }
          },
          first: 50,
          orderBy: updatedAt
        ) {
          nodes {
            id
            body
            createdAt
            updatedAt
            user {
              id
              name
              displayName
            }
            issue {
              id
              identifier
              title
              url
              creator {
                id
                name
                displayName
              }
              assignee {
                id
                name
                displayName
              }
              subscribers {
                nodes {
                  id
                  name
                  displayName
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const response = await axios.post(
      'https://api.linear.app/graphql',
      {
        query,
        variables: {
          lastSyncTime,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: accessToken,
        },
      },
    );

    return response.data.data.comments;
  } catch (error) {
    throw error;
  }
}

/**
 * Process issue activities and create appropriate activity records
 */
async function processIssueActivities(issues: any[], userId: string) {
  const activities = [];

  for (const issue of issues) {
    try {
      // Skip issues that don't involve the user
      const isAssignee = issue.assignee?.id === userId;
      const isCreatedByUser = issue.creator?.id === userId;

      // Check if user is subscribed to the issue
      const isSubscribed =
        issue.subscribers?.nodes?.some((subscriber: any) => subscriber.id === userId) || false;

      if (!isAssignee && !isCreatedByUser && !isSubscribed) {
        continue;
      }

      // Process history to determine what actually changed
      let activityCreated = false;

      // Process assignment changes first (highest priority)
      if (issue.history && issue.history.nodes) {
        for (const historyItem of issue.history.nodes) {
          if (historyItem.toAssigneeId && historyItem.fromAssigneeId !== historyItem.toAssigneeId) {
            if (historyItem.toAssigneeId === userId) {
              activities.push(
                createActivityMessage({
                  text: `${issue.identifier} (${issue.title}) Issue assigned to you`,
                  sourceURL: issue.url,
                }),
              );
              activityCreated = true;
              break;
            } else if (isCreatedByUser && historyItem.fromAssigneeId === userId) {
              activities.push(
                createActivityMessage({
                  text: `${issue.identifier} (${issue.title}) Issue unassigned from you`,
                  sourceURL: issue.url,
                }),
              );
              activityCreated = true;
              break;
            }
          }
        }
      }

      // If no assignment change, check for status changes
      if (!activityCreated && issue.history && issue.history.nodes) {
        for (const historyItem of issue.history.nodes) {
          if (historyItem.toStateId && historyItem.fromStateId !== historyItem.toStateId) {
            if (!isAssignee && !isCreatedByUser && !isSubscribed) {
              continue;
            }

            const stateType = issue.state?.type;
            let statusText = `moved to ${issue.state?.name || 'a new status'}`;

            if (stateType === 'completed') {
              statusText = 'completed';
            } else if (stateType === 'canceled') {
              statusText = 'canceled';
            }

            let title;
            if (isCreatedByUser || isAssignee) {
              title = `${issue.identifier} (${issue.title}) Issue ${statusText}`;
            } else {
              title = `${issue.identifier} (${issue.title}) Issue ${statusText}`;
            }

            activities.push(
              createActivityMessage({
                text: title,
                sourceURL: issue.url,
              }),
            );
            activityCreated = true;
            break;
          }
        }
      }

      // If no history changes, check if it's a new issue creation
      if (!activityCreated && isCreatedByUser) {
        // Only create activity if issue was created recently (within sync window)
        const createdAt = new Date(issue.createdAt);
        const updatedAt = new Date(issue.updatedAt);

        // If created and updated times are very close, it's likely a new issue
        if (Math.abs(createdAt.getTime() - updatedAt.getTime()) < 60000) {
          // within 1 minute
          activities.push(
            createActivityMessage({
              text: `${issue.identifier} (${issue.title}) Issue created`,
              sourceURL: issue.url,
            }),
          );
          activityCreated = true;
        }
      }
    } catch (error) {
      // Silently ignore errors to prevent stdout pollution
    }
  }

  return activities;
}

/**
 * Process comment activities and create appropriate activity records
 */
async function processCommentActivities(comments: any[], userId: string, userInfo: any) {
  const activities = [];

  for (const comment of comments) {
    try {
      const isCommenter = comment.user?.id === userId;
      const isIssueCreator = comment.issue?.creator?.id === userId;
      const isAssignee = comment.issue?.assignee?.id === userId;

      // Check if user is subscribed to the issue
      const isSubscribed =
        comment.issue?.subscribers?.nodes?.some((subscriber: any) => subscriber.id === userId) ||
        false;

      // Check for mentions in the comment body
      const isMentioned = checkForUserMentions(comment.body, userInfo);

      // Skip if not relevant to user
      if (!isCommenter && !isIssueCreator && !isAssignee && !isSubscribed && !isMentioned) {
        continue;
      }

      let title;

      if (isCommenter) {
        // Comment created by the user
        title = `You commented on issue ${comment.issue.identifier}: ${truncateText(comment.body, 100)}`;
      } else if (isMentioned) {
        // User was mentioned in the comment
        title = `${comment.user?.name || 'Someone'} mentioned you in issue ${comment.issue.identifier}: ${truncateText(comment.body, 100)}`;
      } else if (isAssignee || isIssueCreator || isSubscribed) {
        // Comment on issue where user is assignee, creator, or subscriber
        let relation = 'an issue';
        if (isAssignee) {
          relation = 'your assigned issue';
        } else if (isIssueCreator) {
          relation = 'your issue';
        } else if (isSubscribed) {
          relation = "an issue you're subscribed to";
        }
        title = `${comment.user?.name || 'Someone'} commented on ${relation} ${comment.issue.identifier}: ${truncateText(comment.body, 100)}`;
      }

      if (title) {
        activities.push(
          createActivityMessage({
            text: title,
            sourceURL: `${comment.issue.url}#comment-${comment.id}`,
          }),
        );
      }
    } catch (error) {
      // Silently ignore errors to prevent stdout pollution
    }
  }

  return activities;
}

/**
 * Helper function to check for user mentions in text
 */
function checkForUserMentions(text: string, userInfo: any): boolean {
  if (!text || !userInfo) return false;

  const lowerText = text.toLowerCase();

  // Check for @username, @display name, or @email mentions
  const mentionPatterns = [
    userInfo.name && `@${userInfo.name.toLowerCase()}`,
    userInfo.displayName && `@${userInfo.displayName.toLowerCase()}`,
    userInfo.email && `@${userInfo.email.toLowerCase()}`,
  ].filter(Boolean);

  return mentionPatterns.some((pattern) => lowerText.includes(pattern));
}

/**
 * Helper function to truncate text with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

/**
 * Helper function to get default sync time (24 hours ago)
 */
function getDefaultSyncTime(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString();
}

/**
 * Main function to handle scheduled sync for Linear integration
 */
export async function handleSchedule(config: any, state: any) {
  try {
    const integrationConfiguration = config;

    // Check if we have a valid access token
    if (!integrationConfiguration?.accessToken) {
      return [];
    }

    // Get settings or initialize if not present
    let settings = (state || {}) as LinearSettings;

    // Default to 24 hours ago if no last sync times
    const lastIssuesSync = settings.lastIssuesSync || getDefaultSyncTime();
    const lastCommentsSync = settings.lastCommentsSync || getDefaultSyncTime();

    // Fetch user info to identify activities relevant to them
    let user;
    try {
      user = await fetchUserInfo(integrationConfiguration.accessToken);
    } catch (error) {
      return [];
    }

    if (!user || !user.id) {
      return [];
    }

    // Collect all messages
    const messages = [];

    // Process all issue activities (created, assigned, updated, etc.)
    try {
      const issues = await fetchRecentIssues(integrationConfiguration.accessToken, lastIssuesSync);
      if (issues && issues.nodes) {
        const issueActivities = await processIssueActivities(issues.nodes, user.id);
        messages.push(...issueActivities);
      }
    } catch (error) {
      // Silently ignore errors to prevent stdout pollution
    }

    // Process all comment activities
    try {
      const comments = await fetchRecentComments(
        integrationConfiguration.accessToken,
        lastCommentsSync,
      );
      if (comments && comments.nodes) {
        const commentActivities = await processCommentActivities(comments.nodes, user.id, user);
        messages.push(...commentActivities);
      }
    } catch (error) {
      // Silently ignore errors to prevent stdout pollution
    }

    // Update last sync times
    const newSyncTime = new Date().toISOString();

    // Add state message for saving settings
    messages.push({
      type: 'state',
      data: {
        ...settings,
        lastIssuesSync: newSyncTime,
        lastCommentsSync: newSyncTime,
      },
    });

    return messages;
  } catch (error) {
    return [];
  }
}

/**
 * The main handler for the scheduled sync event
 */
export async function scheduleHandler(config: any, state: any) {
  return handleSchedule(config, state);
}
