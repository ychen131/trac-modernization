# Test Projects Directory

## Purpose
This directory contains fallback Trac environments used for:

1. **Demo/Testing Data** - Provides sample tickets and project structure for development and demonstrations
2. **Backward Compatibility** - API endpoints work without requiring a project selection
3. **Development Convenience** - No need to create projects during development setup

## Structure
- `my-drone-project/` - Sample Trac environment with demo tickets and data

## When It's Used
- When frontend makes API calls without the `X-Project-Id` header
- Before users create their first project through the UI
- For development testing when you want consistent sample data

## User-Created Projects
User-created projects are stored separately in:
- **Production:** `/app/data/trac-projects/project-{uuid}/`  
- **Development:** `../data/trac-projects/project-{uuid}/`

Each user project is completely isolated from this fallback environment.

## Can I Delete This?
You can delete this directory if you want to force a pure project-based workflow, but:
- API calls without projects will return 503 errors
- New users will see empty states until they create projects
- Development will require creating test projects manually

**Recommendation:** Keep it for better UX and development convenience. 