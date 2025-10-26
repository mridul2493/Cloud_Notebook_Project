const express = require('express');
const { SearchService } = require('../config/aws');
const { requirePermission } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/search
 * Search notebooks with AI-powered natural language queries
 */
router.get('/', requirePermission('read_own_notebooks'), async (req, res) => {
  try {
    const { 
      q: query, 
      page = 1, 
      limit = 20, 
      subject, 
      course, 
      owner, 
      tags,
      dateFrom,
      dateTo,
      sortBy = 'relevance',
      sortOrder = 'desc'
    } = req.query;

    if (!query) {
      return res.status(400).json({
        error: {
          message: 'Search query is required',
          code: 'NO_QUERY'
        }
      });
    }

    const userId = req.user.id;
    const userRole = req.user.role;

    // Build search filters
    const filters = {
      subject,
      course,
      owner,
      tags: tags ? tags.split(',') : undefined,
      dateFrom,
      dateTo
    };

    // Perform search
    const searchResults = await SearchService.searchNotebooks(query, userId, filters);

    // Apply role-based filtering
    const filteredResults = await filterSearchResultsByRole(searchResults, userId, userRole);

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedResults = filteredResults.slice(startIndex, endIndex);

    // Enhance results with additional metadata
    const enhancedResults = await enhanceSearchResults(paginatedResults);

    res.json({
      query,
      results: enhancedResults,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(filteredResults.length / limit),
        totalResults: filteredResults.length,
        resultsPerPage: parseInt(limit)
      },
      filters: {
        applied: Object.keys(filters).filter(key => filters[key]),
        available: ['subject', 'course', 'owner', 'tags', 'dateFrom', 'dateTo']
      },
      searchTime: Date.now() // In production, calculate actual search time
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      error: {
        message: 'Search failed',
        code: 'SEARCH_ERROR'
      }
    });
  }
});

/**
 * GET /api/search/suggestions
 * Get search suggestions based on user's notebooks and activity
 */
router.get('/suggestions', requirePermission('read_own_notebooks'), async (req, res) => {
  try {
    const { q: query } = req.query;
    const userId = req.user.id;

    // Get user's notebook titles and tags for suggestions
    const { DynamoDBService } = require('../config/aws');
    const userNotebooks = await DynamoDBService.getUserNotebooks(userId);

    const suggestions = [];

    if (query && query.length > 0) {
      // Find matching titles
      const titleMatches = userNotebooks
        .filter(notebook => 
          notebook.title.toLowerCase().includes(query.toLowerCase())
        )
        .map(notebook => ({
          type: 'title',
          text: notebook.title,
          notebookId: notebook.id
        }));

      suggestions.push(...titleMatches.slice(0, 5));

      // Find matching subjects
      const subjects = [...new Set(userNotebooks.map(n => n.subject).filter(Boolean))];
      const subjectMatches = subjects
        .filter(subject => subject.toLowerCase().includes(query.toLowerCase()))
        .map(subject => ({
          type: 'subject',
          text: subject
        }));

      suggestions.push(...subjectMatches.slice(0, 3));

      // Find matching courses
      const courses = [...new Set(userNotebooks.map(n => n.course).filter(Boolean))];
      const courseMatches = courses
        .filter(course => course.toLowerCase().includes(query.toLowerCase()))
        .map(course => ({
          type: 'course',
          text: course
        }));

      suggestions.push(...courseMatches.slice(0, 3));
    } else {
      // Popular searches for this user (mock data)
      suggestions.push(
        { type: 'recent', text: 'machine learning notes' },
        { type: 'recent', text: 'database design' },
        { type: 'recent', text: 'algorithm analysis' },
        { type: 'popular', text: 'data structures' },
        { type: 'popular', text: 'web development' }
      );
    }

    res.json({
      query: query || '',
      suggestions: suggestions.slice(0, 10)
    });
  } catch (error) {
    console.error('Search suggestions error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get search suggestions',
        code: 'SUGGESTIONS_ERROR'
      }
    });
  }
});

/**
 * GET /api/search/facets
 * Get search facets (filters) available for the user
 */
router.get('/facets', requirePermission('read_own_notebooks'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { DynamoDBService } = require('../config/aws');
    
    const userNotebooks = await DynamoDBService.getUserNotebooks(userId);

    const facets = {
      subjects: [...new Set(userNotebooks.map(n => n.subject).filter(Boolean))],
      courses: [...new Set(userNotebooks.map(n => n.course).filter(Boolean))],
      owners: [...new Set(userNotebooks.map(n => n.owner))],
      collaborators: [...new Set(userNotebooks.flatMap(n => n.collaborators || []))],
      tags: [...new Set(userNotebooks.flatMap(n => n.tags || []))],
      dateRanges: [
        { label: 'Last week', value: 'week' },
        { label: 'Last month', value: 'month' },
        { label: 'Last 3 months', value: '3months' },
        { label: 'Last year', value: 'year' }
      ]
    };

    res.json({
      facets,
      totalNotebooks: userNotebooks.length
    });
  } catch (error) {
    console.error('Search facets error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get search facets',
        code: 'FACETS_ERROR'
      }
    });
  }
});

/**
 * POST /api/search/advanced
 * Advanced search with complex queries
 */
router.post('/advanced', requirePermission('read_own_notebooks'), async (req, res) => {
  try {
    const {
      queries, // Array of query objects
      operator = 'AND', // AND/OR
      filters = {},
      sortBy = 'relevance',
      sortOrder = 'desc',
      page = 1,
      limit = 20
    } = req.body;

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({
        error: {
          message: 'At least one query is required',
          code: 'NO_QUERIES'
        }
      });
    }

    const userId = req.user.id;
    const userRole = req.user.role;

    // Build complex search query
    const searchQuery = {
      queries,
      operator,
      filters,
      sortBy,
      sortOrder
    };

    // Execute advanced search
    const searchResults = await executeAdvancedSearch(searchQuery, userId);

    // Apply role-based filtering
    const filteredResults = await filterSearchResultsByRole(searchResults, userId, userRole);

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedResults = filteredResults.slice(startIndex, endIndex);

    // Enhance results
    const enhancedResults = await enhanceSearchResults(paginatedResults);

    res.json({
      searchQuery,
      results: enhancedResults,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(filteredResults.length / limit),
        totalResults: filteredResults.length,
        resultsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Advanced search error:', error);
    res.status(500).json({
      error: {
        message: 'Advanced search failed',
        code: 'ADVANCED_SEARCH_ERROR'
      }
    });
  }
});

/**
 * GET /api/search/analytics
 * Get search analytics for the user
 */
router.get('/analytics', requirePermission('read_own_notebooks'), async (req, res) => {
  try {
    const userId = req.user.id;

    // Mock analytics data (in production, this would come from actual search logs)
    const analytics = {
      totalSearches: 156,
      topQueries: [
        { query: 'machine learning', count: 23 },
        { query: 'database design', count: 18 },
        { query: 'algorithms', count: 15 },
        { query: 'web development', count: 12 },
        { query: 'data structures', count: 10 }
      ],
      searchTrends: [
        { date: '2024-01-01', searches: 15 },
        { date: '2024-01-02', searches: 22 },
        { date: '2024-01-03', searches: 18 },
        { date: '2024-01-04', searches: 25 },
        { date: '2024-01-05', searches: 20 }
      ],
      averageResultsPerSearch: 8.5,
      mostAccessedNotebooks: [
        { notebookId: 'notebook-1', title: 'ML Fundamentals', accessCount: 45 },
        { notebookId: 'notebook-2', title: 'Database Theory', accessCount: 38 },
        { notebookId: 'notebook-3', title: 'Algorithm Design', accessCount: 32 }
      ]
    };

    res.json({
      userId,
      analytics,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Search analytics error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get search analytics',
        code: 'ANALYTICS_ERROR'
      }
    });
  }
});

// Helper functions
async function filterSearchResultsByRole(results, userId, userRole) {
  // Filter results based on user role and permissions
  const { canAccessNotebook } = require('../middleware/auth');
  
  const filteredResults = [];
  
  for (const result of results) {
    const hasAccess = await canAccessNotebook(userId, userRole, result.notebookId, 'read');
    if (hasAccess) {
      filteredResults.push(result);
    }
  }
  
  return filteredResults;
}

async function enhanceSearchResults(results) {
  // Enhance results with additional metadata
  const { DynamoDBService } = require('../config/aws');
  
  const enhancedResults = [];
  
  for (const result of results) {
    try {
      const notebook = await DynamoDBService.getNotebook(result.notebookId);
      if (notebook) {
        enhancedResults.push({
          ...result,
          notebook: {
            id: notebook.id,
            title: notebook.title,
            owner: notebook.owner,
            subject: notebook.subject,
            course: notebook.course,
            tags: notebook.tags,
            updated_at: notebook.updated_at,
            collaborators: notebook.collaborators
          }
        });
      }
    } catch (error) {
      console.error('Error enhancing result:', error);
      // Include result without enhancement if there's an error
      enhancedResults.push(result);
    }
  }
  
  return enhancedResults;
}

async function executeAdvancedSearch(searchQuery, userId) {
  // Mock implementation for advanced search
  // In production, this would use OpenSearch/Elasticsearch with complex queries
  
  console.log('Executing advanced search:', searchQuery, 'for user:', userId);
  
  // Return mock results
  return [
    {
      notebookId: 'notebook-1',
      score: 0.95,
      highlights: ['machine learning algorithm'],
      matchedFields: ['title', 'content']
    },
    {
      notebookId: 'notebook-2',
      score: 0.87,
      highlights: ['neural network implementation'],
      matchedFields: ['content', 'tags']
    }
  ];
}

module.exports = router;
