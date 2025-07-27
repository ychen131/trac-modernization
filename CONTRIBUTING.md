# 🤝 Contributing to HobbyTrack

Thank you for your interest in contributing to HobbyTrack! This guide will help you get started with development and outline our contribution process.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Issue Guidelines](#issue-guidelines)
- [Feature Requests](#feature-requests)

## Development Setup

### Prerequisites

- **Node.js** 18+ and **npm** 8+
- **Python** 3.9+ and **pip**
- **Docker** and **Docker Compose** (optional but recommended)
- **Git** for version control

### Local Development Environment

1. **Fork and Clone**
   ```bash
   # Fork the repository on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/hobbytrack.git
   cd hobbytrack
   ```

2. **Environment Setup**
   ```bash
   # Copy environment template
   cp .env.example .env
   # Edit .env with your Clerk credentials (see SETUP.md)
   ```

3. **Backend Setup**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

4. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install
   ```

5. **Start Development Servers**
   ```bash
   # Terminal 1: Backend
   cd backend
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   
   # Terminal 2: Frontend
   cd frontend
   npm run dev
   ```

### Docker Development

For a containerized development environment:

```bash
# Start development environment
docker-compose up

# Rebuild after changes
docker-compose down
docker-compose build --no-cache
docker-compose up
```

## Project Structure

```
hobbytrack/
├── 📁 backend/                 # FastAPI application
│   ├── 📁 app/
│   │   ├── 📁 core/           # Core functionality (config, security)
│   │   ├── 📁 routers/        # API endpoints
│   │   ├── 📁 crud/           # Database operations
│   │   └── main.py            # FastAPI app entry point
│   ├── 📁 tests/              # Backend tests
│   └── requirements.txt       # Python dependencies
├── 📁 frontend/               # React TypeScript application  
│   ├── 📁 src/
│   │   ├── 📁 components/     # React components
│   │   ├── 📁 hooks/          # Custom React hooks
│   │   ├── 📁 pages/          # Page components
│   │   ├── 📁 types/          # TypeScript type definitions
│   │   └── 📁 utils/          # Utility functions
│   ├── 📁 public/             # Static assets
│   └── package.json           # Node.js dependencies
├── 📁 trac-legacy/            # Legacy Trac codebase (read-only)
├── 🐳 docker-compose.yml      # Container orchestration
├── 📄 README.md               # Main documentation
└── 📄 CONTRIBUTING.md         # This file
```

### Key Technologies

- **Backend**: FastAPI, SQLAlchemy, Pydantic, Clerk Auth
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, @dnd-kit
- **Database**: SQLite (via legacy Trac)
- **Authentication**: Clerk
- **Deployment**: Docker, multi-stage builds

## Development Workflow

### 1. Choose or Create an Issue

- Check [existing issues](https://github.com/your-repo/hobbytrack/issues)
- Comment on an issue to claim it
- Create a new issue for bugs or feature requests

### 2. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
```

### 3. Make Your Changes

- Follow our [coding standards](#coding-standards)
- Write tests for new functionality
- Update documentation if needed
- Test your changes thoroughly

### 4. Commit Your Changes

```bash
git add .
git commit -m "feat: add task priority sorting

- Add priority-based sorting to Kanban board
- Update task component to display priority colors
- Add tests for sorting functionality"
```

Use conventional commit format:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `test:` for adding tests
- `refactor:` for code refactoring
- `style:` for formatting changes

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub with:
- Clear description of changes
- Reference to related issues
- Screenshots for UI changes
- Testing instructions

## Coding Standards

### Backend (Python)

- **PEP 8**: Follow Python style guidelines
- **Type hints**: Use type annotations for all functions
- **Docstrings**: Document functions and classes
- **Error handling**: Use appropriate exception handling

```python
from typing import List, Optional
from fastapi import HTTPException

async def get_tickets(user_id: str, limit: Optional[int] = 10) -> List[Ticket]:
    """Retrieve tickets for a specific user.
    
    Args:
        user_id: The authenticated user's ID
        limit: Maximum number of tickets to return
        
    Returns:
        List of ticket objects
        
    Raises:
        HTTPException: If user is not found or access denied
    """
    try:
        # Implementation here
        pass
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

- **Formatting**: Use `black` for code formatting
- **Linting**: Use `flake8` for linting

```bash
# Format code
black app/

# Check linting
flake8 app/
```

### Frontend (TypeScript/React)

- **TypeScript**: Use strict type checking
- **Component structure**: Functional components with hooks
- **Naming**: PascalCase for components, camelCase for functions/variables
- **Props interfaces**: Define interfaces for all component props

```typescript
interface TaskCardProps {
  task: Task;
  onUpdate: (taskId: string, updates: Partial<Task>) => void;
  onDelete: (taskId: string) => void;
  isDragging?: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  onUpdate, 
  onDelete, 
  isDragging = false 
}) => {
  // Component implementation
};
```

- **Hooks**: Create custom hooks for reusable logic
- **Error boundaries**: Implement error handling for components
- **Accessibility**: Include ARIA labels and keyboard navigation

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Fix linting issues
npm run lint:fix
```

### CSS/Styling

- **Tailwind CSS**: Use utility classes primarily
- **Custom CSS**: Minimal custom styles in component CSS files
- **Responsive design**: Mobile-first approach
- **Consistent spacing**: Use Tailwind spacing scale

```tsx
// Good: Utility classes with responsive design
<div className="bg-white rounded-lg shadow-md p-4 md:p-6 hover:shadow-lg transition-shadow">
  <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">
    {task.title}
  </h2>
</div>
```

## Testing

### Backend Testing

Tests are written using pytest:

```bash
# Run all tests
cd backend
python -m pytest

# Run with coverage
python -m pytest --cov=app tests/

# Run specific test file
python -m pytest tests/test_tickets.py
```

**Test structure**:
```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_get_tickets():
    response = client.get("/api/tickets")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
```

### Frontend Testing

Tests use Vitest and React Testing Library:

```bash
# Run tests
cd frontend
npm run test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

**Test structure**:
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskCard } from './TaskCard';

describe('TaskCard', () => {
  it('renders task title and description', () => {
    const mockTask = {
      id: '1',
      title: 'Test Task',
      description: 'Test description'
    };
    
    render(<TaskCard task={mockTask} onUpdate={jest.fn()} onDelete={jest.fn()} />);
    
    expect(screen.getByText('Test Task')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });
});
```

### Integration Testing

Test the full application flow:

```bash
# Start the application
docker-compose up

# Run integration tests (when available)
npm run test:integration
```

## Submitting Changes

### Pull Request Guidelines

1. **Clear title**: Describe what the PR does
2. **Detailed description**: Explain the changes and why they're needed
3. **Issue reference**: Link to related issues
4. **Screenshots**: Include for UI changes
5. **Testing**: Describe how to test the changes
6. **Breaking changes**: Highlight any breaking changes

### PR Template

```markdown
## Description
Brief description of changes

## Related Issues
Fixes #123

## Type of Change
- [ ] Bug fix
- [ ] New feature  
- [ ] Documentation update
- [ ] Performance improvement

## Testing
- [ ] All tests pass
- [ ] New tests added for new functionality
- [ ] Manual testing completed

## Screenshots (if applicable)
[Include screenshots for UI changes]

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings or errors
```

### Review Process

1. **Automated checks**: All CI checks must pass
2. **Code review**: At least one maintainer review required
3. **Testing**: Manual testing by reviewers
4. **Approval**: PR approved by maintainer
5. **Merge**: Squash and merge to main branch

## Issue Guidelines

### Bug Reports

Use the bug report template:

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g. macOS, Windows, Linux]
- Browser [e.g. chrome, safari]
- Version [e.g. 22]

**Additional context**
Any other context about the problem.
```

### Enhancement Requests

Use the feature request template:

```markdown
**Is your feature request related to a problem?**
A clear description of what the problem is.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Alternative solutions or features you've considered.

**Additional context**
Add any other context or screenshots about the feature request.
```

## Feature Requests

We welcome feature requests! Before submitting:

1. **Check existing issues**: Make sure it hasn't been requested
2. **Consider scope**: Keep requests focused and achievable
3. **Provide context**: Explain the use case and benefits
4. **Be open to discussion**: We may suggest alternatives

### Priority Levels

- **P0 - Critical**: Security issues, data loss, app crashes
- **P1 - High**: Major functionality broken, significant UX issues
- **P2 - Medium**: Minor functionality issues, enhancement requests
- **P3 - Low**: Nice-to-have features, cosmetic improvements

## Development Tips

### Working with Legacy Trac Code

- **Read-only**: Don't modify files in `trac-legacy/`
- **Import carefully**: Use specific imports from Trac modules
- **Error handling**: Wrap Trac calls in try-catch blocks
- **Documentation**: Document any Trac interactions

### Performance Considerations

- **API efficiency**: Minimize database queries
- **Frontend optimization**: Use React.memo for expensive components
- **File uploads**: Stream large files, don't load into memory
- **Caching**: Implement appropriate caching strategies

### Security Best Practices

- **Authentication**: Always verify user permissions
- **Input validation**: Validate all user inputs
- **File uploads**: Restrict file types and sizes
- **Error messages**: Don't leak sensitive information

## Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Code Review**: Ask questions in PR comments
- **Documentation**: Check existing docs first

## Recognition

Contributors will be recognized in:
- **Contributors section**: Listed in README
- **Release notes**: Mentioned in version releases
- **GitHub**: Contributor badge on profile

Thank you for contributing to HobbyTrack! 🚀 