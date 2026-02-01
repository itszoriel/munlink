# SerbisyoZambaleño Design System

**Version 1.0** | Last Updated: 2026-01-29

This document is the single source of truth for all design decisions in the SerbisyoZambaleño platform. It ensures visual consistency across the public site (`apps/web`) and admin dashboard (`apps/admin`).

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Components](#components)
6. [Animation Guidelines](#animation-guidelines)
7. [Accessibility](#accessibility)
8. [Implementation Guide](#implementation-guide)

---

## Design Philosophy

### Core Principles

1. **Professional yet Approachable**: Government platform that balances authority with modern user experience
2. **Zambales-Centric**: Visual identity reflects the province's coastal and community-oriented nature
3. **Accessibility First**: WCAG 2.1 AA compliance, keyboard navigation, screen reader support
4. **Mobile-First**: Responsive design patterns that work on all devices
5. **Performance**: Lightweight animations, optimized assets, fast load times

### Visual Direction

- **Ocean Theme (Primary)**: Represents coastal Zambales, trust, and government services
- **Forest Theme (Success)**: Natural growth, verified/approved states, marketplace
- **Sunset Theme (Accent)**: Community warmth, marketplace, special programs
- **Clean & Modern**: White backgrounds, subtle shadows, generous spacing

---

## Color System

### Brand Gradients

These gradients define SerbisyoZambaleño's visual identity. Use them consistently according to their semantic meaning.

```css
/* Ocean Gradient - Primary brand color */
.bg-ocean-gradient {
  background: linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%);
}

/* Ocean Soft - Light backgrounds, hover states */
.bg-ocean-gradient-soft {
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
}

/* Forest Gradient - Success, verification, nature/agriculture */
.bg-forest-gradient {
  background: linear-gradient(135deg, #10b981 0%, #047857 100%);
}

/* Sunset Gradient - Community, marketplace, warmth */
.bg-sunset-gradient {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

/* Purple Gradient - Admin-only, special features */
.bg-purple-gradient {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
}

/* Rose Gradient - Urgent, problems, alerts */
.bg-rose-gradient {
  background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
}
```

### When to Use Each Gradient

| Gradient | Use Cases | Examples |
|----------|-----------|----------|
| **Ocean** | Primary actions, headers, admin theme, document services | Login button, hero sections, admin sidebar |
| **Forest** | Success states, verified badges, approved items, agriculture/nature content | "Verified" badges, success messages, marketplace "Available" status |
| **Sunset** | Marketplace, community features, benefit programs | Marketplace cards, donation items, program banners |
| **Purple** | Super admin features, special admin tools | Super admin panel, advanced settings |
| **Rose** | Urgent announcements, problem reports, errors | High-priority alerts, critical notices |

### Semantic Colors

```css
/* Primary - Sky Blue (ocean-inspired) */
--color-primary: #0ea5e9;
--color-primary-hover: #0284c7;
--color-primary-light: #e0f2fe;

/* Accent - Green (forest/growth) */
--color-accent: #10b981;
--color-accent-hover: #059669;

/* Surfaces */
--color-surface: #f8fafc;          /* Page background */
--color-surface-elevated: #ffffff;  /* Cards, modals */

/* Text */
--color-surface-foreground: #0f172a;  /* Primary text */
--color-card-foreground: #1e293b;     /* Card text */
--color-muted: #64748b;               /* Secondary text */
--color-muted-foreground: #94a3b8;    /* Tertiary text */

/* Borders */
--color-border: #e2e8f0;       /* Default borders */
--color-border-light: #f1f5f9; /* Subtle dividers */

/* Status Colors */
--color-success: #10b981;
--color-success-light: #ecfdf5;
--color-error: #ef4444;
--color-error-light: #fef2f2;
--color-warning: #f59e0b;
--color-warning-light: #fffbeb;
--color-info: #3b82f6;
--color-info-light: #eff6ff;
```

### Color Usage Rules

#### Text Hierarchy
1. **Primary headings/body** → `text-slate-900`
2. **Secondary text** → `text-slate-600` or `text-slate-700`
3. **Muted/helper text** → `text-slate-500`
4. **Disabled text** → `text-slate-400`

#### Background Hierarchy
1. **Page background** → `bg-slate-50` (admin) or `bg-gradient-to-br from-slate-50 via-white to-sky-50/30` (web)
2. **Card/elevated surface** → `bg-white`
3. **Hover states** → `bg-slate-50` or `bg-slate-100`
4. **Active/selected** → `bg-sky-50` or light gradient

#### Border Hierarchy
1. **Subtle dividers** → `border-slate-100`
2. **Card borders** → `border-slate-200/60`
3. **Emphasized borders** → `border-slate-300`
4. **Focus/active** → `border-sky-500`

---

## Typography

### Font Stack

```css
/* System font stack for performance */
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

### Type Scale

Use fluid typography for responsive text sizing:

| Class | Size Range | Use Case |
|-------|------------|----------|
| `text-fluid-sm` | 0.75rem → 0.875rem | Small labels, metadata |
| `text-fluid-base` | 0.875rem → 1rem | Body text, paragraphs |
| `text-fluid-lg` | 1rem → 1.125rem | Large body, emphasis |
| `text-fluid-xl` | 1.125rem → 1.25rem | Subtitles, lead text |
| `text-fluid-2xl` | 1.25rem → 1.5rem | H4, card titles |
| `text-fluid-3xl` | 1.5rem → 1.875rem | H3, section headers |
| `text-fluid-4xl` | 1.875rem → 2.25rem | H2, page headers |

### Typography Hierarchy

```tsx
// Hero Title (H1)
<h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white">
  Welcome to SerbisyoZambaleño Zambales
</h1>

// Page Title (H1)
<h1 className="text-fluid-4xl font-semibold tracking-tight text-slate-900">
  Document Services
</h1>

// Section Header (H2)
<h2 className="text-fluid-3xl font-semibold tracking-tight text-slate-900">
  Recent Announcements
</h2>

// Card Title (H3)
<h3 className="text-fluid-2xl font-semibold text-slate-900">
  Request Barangay Clearance
</h3>

// Subsection (H4)
<h4 className="text-fluid-xl font-medium text-slate-800">
  Personal Information
</h4>

// Body Text
<p className="text-base text-slate-600 leading-relaxed">
  Regular paragraph content goes here.
</p>

// Small/Helper Text
<span className="text-sm text-slate-500">
  Last updated 2 hours ago
</span>
```

### Font Weight Usage

- **font-semibold (600)**: Headings, important labels
- **font-medium (500)**: Buttons, emphasized text, card titles
- **font-normal (400)**: Body text, default
- **font-light (300)**: Large display text only (rare)

### Text Colors by Context

```tsx
// Default
text-slate-900  // Primary headings
text-slate-800  // Secondary headings
text-slate-700  // Strong body text
text-slate-600  // Normal body text
text-slate-500  // Muted text, labels
text-slate-400  // Disabled text

// Colored Text (use sparingly)
text-sky-600    // Links, informational
text-emerald-600 // Success text
text-amber-600   // Warning text
text-red-600     // Error text
```

---

## Spacing & Layout

### Spacing Scale

Based on 4px (0.25rem) base unit:

| Token | Value | Use Case |
|-------|-------|----------|
| `gap-2` | 0.5rem (8px) | Tight spacing (icon + text) |
| `gap-3` | 0.75rem (12px) | Button content spacing |
| `gap-4` | 1rem (16px) | Standard element spacing |
| `gap-6` | 1.5rem (24px) | Card content spacing |
| `gap-8` | 2rem (32px) | Section spacing (small) |
| `gap-12` | 3rem (48px) | Section spacing (medium) |
| `gap-16` | 4rem (64px) | Section spacing (large) |
| `gap-20` | 5rem (80px) | Major section spacing |

### Padding Patterns

```tsx
// Cards
<div className="p-6">             // Standard card padding
<div className="p-6 sm:p-8">     // Responsive card padding
<div className="px-6 py-4">      // Compact card padding

// Sections
<section className="py-12">       // Small section
<section className="py-16">       // Medium section
<section className="py-20">       // Large section
<section className="py-12 md:py-16 lg:py-20"> // Responsive

// Container
<div className="container mx-auto px-4 sm:px-6 lg:px-8">
// Or use utility class:
<div className="container-responsive">
```

### Layout Patterns

#### Max Width Containers

```css
.container-responsive {
  @apply mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8;
}
```

Use `max-w-7xl` (1280px) for most content layouts.

#### Grid Patterns

```tsx
// 2-column responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">

// 3-column responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

// 4-column responsive grid (for small cards)
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

// Auto-fit grid (cards size themselves)
<div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6">
```

#### Flex Patterns

```tsx
// Horizontal stack with spacing
<div className="flex items-center gap-3">

// Space between (navbar pattern)
<div className="flex items-center justify-between">

// Vertical stack
<div className="flex flex-col gap-4">

// Centered content
<div className="flex items-center justify-center min-h-[400px]">

// Wrap on small screens
<div className="flex flex-col sm:flex-row gap-4">
```

---

## Components

### Buttons

#### Button Hierarchy

```tsx
// Primary - Main actions (login, submit, save)
<button className="btn-primary">
  Submit Request
</button>

// Secondary - Alternative actions (cancel, back)
<button className="btn-secondary">
  Cancel
</button>

// Outline - Tertiary actions, filters
<button className="btn-outline">
  Learn More
</button>

// Ghost - Subtle actions, in-card actions
<button className="btn-ghost">
  View Details
</button>

// Danger - Destructive actions (delete, reject)
<button className="btn-danger">
  Delete Item
</button>

// Success - Approval actions
<button className="btn-success">
  Approve Request
</button>
```

#### Button States

```tsx
// Loading state
<button className="btn-primary" disabled>
  <svg className="animate-spin h-4 w-4" />
  Processing...
</button>

// Disabled state (uses disabled: opacity-50)
<button className="btn-primary" disabled>
  Submit
</button>

// With icon
<button className="btn-primary">
  <PlusIcon className="w-4 h-4" />
  Add New
</button>
```

#### Icon Buttons

```tsx
// Default icon button
<button className="icon-btn">
  <PencilIcon className="w-4 h-4" />
</button>

// Primary icon button
<button className="icon-btn primary">
  <CheckIcon className="w-4 h-4" />
</button>

// Danger icon button
<button className="icon-btn danger">
  <TrashIcon className="w-4 h-4" />
</button>
```

### Cards

#### Card Variants

```tsx
// Default - Standard card
<Card variant="default" className="p-6">
  <h3>Card Title</h3>
  <p>Card content...</p>
</Card>

// Elevated - More prominent shadow
<Card variant="elevated" className="p-6">
  <h3>Featured Item</h3>
</Card>

// Glass - Semi-transparent with blur
<Card variant="glass" className="p-6">
  <h3>Overlay Content</h3>
</Card>

// Gradient - Ocean gradient background
<Card variant="gradient" className="p-6">
  <h3 className="text-white">Special Announcement</h3>
</Card>

// Interactive - Hover effect
<Card variant="elevated" hover className="p-6 cursor-pointer">
  <h3>Click Me</h3>
</Card>
```

#### Card Patterns

```tsx
// Stat Card (Dashboard)
<div className="card-stat bg-white p-6">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-slate-600">Total Users</p>
      <p className="text-3xl font-semibold text-slate-900 mt-1">1,234</p>
    </div>
    <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center">
      <UsersIcon className="w-6 h-6 text-sky-600" />
    </div>
  </div>
  <div className="mt-4 flex items-center gap-2 text-sm">
    <span className="text-emerald-600">+12%</span>
    <span className="text-slate-500">from last month</span>
  </div>
</div>

// Content Card
<div className="card p-6">
  <h3 className="text-xl font-semibold text-slate-900">Card Title</h3>
  <p className="text-slate-600 mt-2">Card description goes here.</p>
  <div className="mt-4 flex gap-2">
    <button className="btn-primary">Action</button>
    <button className="btn-ghost">Cancel</button>
  </div>
</div>

// Media Card (Marketplace, Announcements)
<div className="card overflow-hidden">
  <div className="aspect-video bg-slate-200">
    <img src={imageUrl} alt="" className="w-full h-full object-cover" />
  </div>
  <div className="p-6">
    <div className="flex items-center gap-2 mb-2">
      <span className="pill-ocean">Category</span>
      <span className="pill-success">Available</span>
    </div>
    <h3 className="text-lg font-semibold text-slate-900">Item Title</h3>
    <p className="text-slate-600 mt-1 text-sm">Item description...</p>
  </div>
</div>
```

### Forms

#### Input Fields

```tsx
// Standard input
<div className="input-group">
  <label className="input-label">Email Address</label>
  <input
    type="email"
    className="input-field"
    placeholder="you@example.com"
  />
  <span className="input-hint">We'll never share your email.</span>
</div>

// Input with error
<div className="input-group">
  <label className="input-label">Password</label>
  <input
    type="password"
    className="input-field-error"
    placeholder="••••••••"
  />
  <span className="input-error">Password must be at least 8 characters</span>
</div>

// Select dropdown
<div className="input-group">
  <label className="input-label">Municipality</label>
  <select className="input-field">
    <option>Select municipality...</option>
    <option>Iba</option>
    <option>Olongapo</option>
  </select>
</div>

// Textarea
<div className="input-group">
  <label className="input-label">Message</label>
  <textarea
    className="input-field"
    rows={4}
    placeholder="Enter your message..."
  />
</div>
```

#### Form Layout Patterns

```tsx
// Single column form
<form className="space-y-6 max-w-md">
  <div className="input-group">...</div>
  <div className="input-group">...</div>
  <button className="btn-primary w-full">Submit</button>
</form>

// Two column form
<form className="space-y-6">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div className="input-group">...</div>
    <div className="input-group">...</div>
  </div>
  <div className="flex justify-end gap-3">
    <button className="btn-secondary">Cancel</button>
    <button className="btn-primary">Save</button>
  </div>
</form>
```

### Pills & Badges

#### Pills (Rounded, Soft Colors)

```tsx
// Use for status, categories, tags
<span className="pill-neutral">Draft</span>
<span className="pill-ocean">Municipality</span>
<span className="pill-success">Verified</span>
<span className="pill-warning">Pending</span>
<span className="pill-error">Rejected</span>
```

#### Badges (Rectangular, Bright Colors)

```tsx
// Use for counts, notifications, urgent status
<span className="badge-primary">New</span>
<span className="badge-success">5</span>
<span className="badge-warning">!</span>
<span className="badge-error">Urgent</span>
```

#### Status Indicators

```tsx
// Status dot with label
<div className="flex items-center gap-2">
  <span className="status-dot status-dot-success"></span>
  <span className="text-sm text-slate-600">Active</span>
</div>

// Pulsing status dot (for live indicators)
<span className="status-dot status-dot-success status-dot-pulse"></span>
```

### Modals

```tsx
// Modal pattern (using Modal component)
import Modal from '@/components/ui/Modal'

<Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
  <div className="p-6">
    <h2 className="text-2xl font-semibold text-slate-900">Modal Title</h2>
    <p className="text-slate-600 mt-2">Modal content goes here...</p>
    <div className="mt-6 flex justify-end gap-3">
      <button className="btn-secondary" onClick={onClose}>
        Cancel
      </button>
      <button className="btn-primary" onClick={onConfirm}>
        Confirm
      </button>
    </div>
  </div>
</Modal>
```

### Tables (Admin)

```tsx
// Data table pattern
<div className="card overflow-hidden">
  <table className="data-table">
    <thead>
      <tr>
        <th>Name</th>
        <th>Email</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      <tr className="data-row">
        <td className="font-medium">John Doe</td>
        <td className="text-slate-600">john@example.com</td>
        <td>
          <span className="pill-success">Verified</span>
        </td>
        <td>
          <button className="icon-btn">
            <PencilIcon className="w-4 h-4" />
          </button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### Skeletons (Loading States)

```tsx
// Skeleton card
<div className="skeleton-card p-6">
  <div className="skeleton-heading mb-3"></div>
  <div className="skeleton-text mb-2"></div>
  <div className="skeleton-text w-1/2"></div>
</div>

// Skeleton line
<div className="skeleton-line"></div>

// Skeleton avatar + text
<div className="flex items-center gap-3">
  <div className="skeleton-avatar"></div>
  <div className="flex-1">
    <div className="skeleton-line w-1/3 mb-2"></div>
    <div className="skeleton-text w-1/2"></div>
  </div>
</div>
```

### Empty States

```tsx
<div className="empty-state">
  <InboxIcon className="empty-state-icon" />
  <h3 className="empty-state-title">No announcements yet</h3>
  <p className="empty-state-description">
    Check back later for updates from your municipality.
  </p>
  <button className="btn-primary mt-4">
    Refresh
  </button>
</div>
```

---

## Animation Guidelines

### Transition Duration

```css
--transition-fast: 150ms;    /* Micro-interactions (hover, focus) */
--transition-normal: 200ms;  /* Standard transitions (buttons, cards) */
--transition-slow: 300ms;    /* Page transitions, modals */
```

### Animation Classes

```tsx
// Fade in (page content)
<div className="animate-fade-in">...</div>

// Slide up (modals, toasts)
<div className="animate-slide-up">...</div>

// Scale in (success icons, confirmations)
<div className="animate-scale-in">...</div>

// Shimmer (skeleton loaders)
<div className="animate-shimmer">...</div>

// Float (hero decorative elements)
<div className="animate-float">...</div>

// Pulse subtle (loading indicators)
<div className="animate-pulse-subtle">...</div>
```

### Hover Effects

```tsx
// Card hover lift
<div className="card hover-lift">...</div>

// Button hover (built into btn-* classes)
<button className="btn-primary">...</button>

// Custom hover
<div className="transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
  ...
</div>
```

### Usage Guidelines

1. **Keep animations subtle** - Don't distract from content
2. **Use consistent duration** - Stick to the transition tokens
3. **Respect reduced motion** - Users with `prefers-reduced-motion` should see instant transitions
4. **Animate transforms, not layout** - Use `transform` and `opacity` for performance
5. **Loading states** - Use shimmer skeletons instead of spinners when possible

### Animation Decision Tree

```
Is it a micro-interaction (hover, focus)?
  → 150ms transition

Is it a page/section load?
  → animate-fade-in

Is it a modal/drawer opening?
  → animate-slide-up + 300ms

Is it a success confirmation?
  → animate-scale-in

Is it loading content?
  → skeleton shimmer (2s infinite)

Is it a decorative element?
  → animate-float or pulse-subtle
```

---

## Component Library Selections

This section documents all selected components from [21st.dev](https://21st.dev) that will be integrated into SerbisyoZambaleño. Each component is chosen for its design quality, accessibility, and alignment with our design system.

### Overview Table

| Component | Source | Priority | Use Case | Pages | Status |
|-----------|--------|----------|----------|-------|--------|
| **Data Table with Filters** | [TanStack Table](https://21st.dev/community/components/originui/table/data-table-with-filters-made-with-tan-stack-table) | 🔴 Critical | Admin data management | Residents, Requests, Reports | Planned |
| **Animated Counter** | [Build UI](https://21st.dev/builduilabs/animated-counter/default) | 🔴 High | Dashboard statistics | Dashboard | Planned |
| **Aceternity Sidebar** | [Aceternity](https://21st.dev/aceternity/sidebar) | 🟡 Medium | Admin navigation | Admin Layout | Planned |
| **Timeline** | [Aceternity](https://21st.dev/community/components/aceternity/timeline/default) | 🔴 High | Process visualization | About | Approved ✅ |
| **Scroll Velocity** | [Edil-ozi](https://21st.dev/community/components/Edil-ozi/scroll-velocity/default) | 🔴 High | Landmarks showcase | About, Home | Approved ✅ |
| **Modern Hero** | [Uniquesonu](https://21st.dev/community/components/uniquesonu/modern-hero/default) | 🔴 High | Hero sections | About, Home | Approved ✅ |
| **Resizable Columns Table** | [TanStack Table](https://21st.dev/community/components/originui/table/resizable-and-sortable-columns-made-with-tan-stack-table) | 🟢 Nice-to-have | Advanced admin tables | Reports, Audit Log | Planned |
| **Card Components** | [21st.dev Cards](https://21st.dev/s/card) | 🟡 Medium | Feature showcases | Home, About | To Review |
| **Form Inputs** | [21st.dev Inputs](https://21st.dev/s/input) | 🟢 Nice-to-have | Better form UX | Login, Register | To Review |
| **Navbar Components** | [21st.dev Navbar](https://21st.dev/s/navbar) | 🟢 Nice-to-have | Public navigation | Web Layout | To Review |

---

### Priority 1: Dashboard & Admin Components (Critical)

#### 1. Data Table with Filters (TanStack Table)

**Component Link**: [Data Table with Filters](https://21st.dev/community/components/originui/table/data-table-with-filters-made-with-tan-stack-table)

**Why This Component**:
- ✅ Professional, modern design
- ✅ Built-in filtering, sorting, pagination
- ✅ Column visibility toggles
- ✅ Uses TanStack Table (industry standard)
- ✅ Type-safe with TypeScript
- ✅ Highly performant (virtual scrolling support)

**Implementation Locations**:
- `apps/admin/src/pages/Residents.tsx:366-451` - Replace current DataTable
- `apps/admin/src/pages/Requests.tsx` - Document requests table
- `apps/admin/src/pages/Reports.tsx` - Reports data table
- `apps/admin/src/pages/Transactions.tsx` - Transaction history
- `apps/admin/src/pages/AuditLogPage.tsx` - Audit log entries

**Features to Implement**:
```tsx
// Core features from the component
✅ Column sorting (click headers)
✅ Global search filter
✅ Column-specific filters
✅ Pagination with page size selector
✅ Column visibility toggle
✅ Row selection (checkboxes)
✅ Bulk actions
✅ Export to CSV
✅ Responsive (stacks on mobile)
```

**Mobile Responsiveness**:
- Desktop: Full table with all columns
- Tablet: Hide less important columns, show toggle
- Mobile: Card-based layout with expandable rows

**Customization for SerbisyoZambaleño**:
```tsx
// Apply SerbisyoZambaleño design tokens
- Primary color: ocean-gradient
- Status badges: pill-success, pill-warning, pill-error
- Hover states: hover:bg-slate-50
- Focus states: ring-sky-500
```

**Alternative Component**: [Resizable & Sortable Columns](https://21st.dev/community/components/originui/table/resizable-and-sortable-columns-made-with-tan-stack-table)
- Use this for advanced admin reports where users need custom column widths

---

#### 2. Animated Counter (Build UI)

**Component Link**: [Animated Counter](https://21st.dev/builduilabs/animated-counter/default)

**Why This Component**:
- ✅ Smooth count-up animation on load
- ✅ Lightweight, performant
- ✅ Professional polish for dashboards
- ✅ Supports large numbers with formatting
- ✅ Built by Build UI (trusted source)

**Implementation Locations**:
- `apps/admin/src/pages/Dashboard.tsx:186-191` - Replace StatCard
- `apps/admin/src/pages/ProvincialAdminDashboard.tsx` - Provincial stats
- `apps/admin/src/pages/BarangayAdminDashboard.tsx` - Barangay stats

**Enhanced Stat Card Pattern**:
```tsx
<StatCard
  title="Pending Verifications"
  value={finalDash.pending_verifications}

  // New features from animated counter
  animateOnMount={true}
  duration={1000}
  format={(n) => n.toLocaleString()} // 1,234

  // Add trend indicators
  trend="+12%"
  trendDirection="up"
  trendColor="forest"

  // Add sparkline (optional)
  sparklineData={[5, 8, 12, 15, 10, 13, 17]}

  // Add click action
  onClick={() => navigate('/residents')}
/>
```

**Mobile Responsiveness**:
- Same animation behavior on all devices
- Faster duration on mobile (500ms vs 1000ms)
- Respects `prefers-reduced-motion`

**Alternative Component**: [Animated Card Chart](https://21st.dev/badtzx0/animated-card-chart)
- Combines counter + mini chart in one card

**Additional Counter Components**: [Animated Number Counter Components](https://21st.dev/s/animated-number-counter)

---

#### 3. Aceternity Sidebar

**Component Link**: [Aceternity Sidebar](https://21st.dev/aceternity/sidebar)

**Why This Component**:
- ✅ Collapsible/expandable (icon-only mode)
- ✅ Active state indicators
- ✅ Smooth animations
- ✅ Mobile responsive (drawer on mobile)
- ✅ Keyboard accessible
- ✅ Professional, modern design

**Implementation Locations**:
- `apps/admin/src/components/AdminHeader.tsx` - Integrate with current layout
- Create new `apps/admin/src/components/ModernSidebar.tsx`

**Features to Implement**:
```tsx
✅ Collapsible sidebar (icon + text → icon only)
✅ Active route highlighting
✅ Section grouping (Residents, Services, Reports, Settings)
✅ Badge counts (e.g., "Pending 5")
✅ Pinned/favorite items
✅ Dark mode toggle at bottom
✅ User profile at top
✅ Mobile: Drawer overlay
```

**Mobile Responsiveness**:
- Desktop: Sidebar always visible, can collapse
- Tablet: Sidebar starts collapsed
- Mobile: Hidden, opens as full-screen drawer

**Navigation Structure**:
```tsx
// Main sections
- Dashboard (home icon)
- Residents (users icon) [badge: pending count]
- Requests (file-text icon) [badge: new requests]
- Problems (alert-triangle icon)
- Marketplace (shopping-bag icon)
- Announcements (megaphone icon)
- Programs (heart icon)
- Reports (bar-chart icon)
- Settings (settings icon)
```

**Additional Sidebar Resources**: [Community Sidebar Components](https://21st.dev/community/components/s/sidebar)

---

### Priority 2: Public Site Components (High)

#### 4. Timeline Component (Aceternity)

**Component Link**: [Aceternity Timeline](https://21st.dev/community/components/aceternity/timeline/default)

**Status**: ✅ **Approved by user**

*See [Scroll Animations](#scroll-animations) section below for full documentation*

**Quick Reference**:
- Use Cases: About page public records, SerbisyoZambaleño history
- Mobile: Single column, compact spacing
- Performance: Low impact

---

#### 5. Scroll Velocity Component (Edil-ozi)

**Component Link**: [Edil-ozi Scroll Velocity](https://21st.dev/community/components/Edil-ozi/scroll-velocity/default)

**Status**: ✅ **Approved by user**

*See [Scroll Animations](#scroll-animations) section below for full documentation*

**Quick Reference**:
- Use Cases: Zambales municipalities landmark showcase
- Mobile: Slower speed, smaller cards
- Performance: Medium impact

---

#### 6. Modern Hero (Uniquesonu)

**Component Link**: [Uniquesonu Modern Hero](https://21st.dev/community/components/uniquesonu/modern-hero/default)

**Status**: ✅ **Approved by user**

*See [Scroll Animations](#scroll-animations) section below for full documentation*

**Quick Reference**:
- Use Cases: About and Home page hero sections
- Mobile: Static gradient, no parallax
- Performance: Medium-high impact

---

### Priority 3: Navigation & Forms (Nice-to-Have)

#### 7. Card Components

**Browse**: [21st.dev Card Components](https://21st.dev/s/card) (79 components)

**Why Cards**:
- ✅ Feature showcases (Home, About pages)
- ✅ Announcement cards
- ✅ Marketplace item cards
- ✅ Program benefit cards
- ✅ Dashboard info cards

**Specific Card Types Needed**:

**A. Feature Cards** (Home page guest notice section)
- **Location**: `apps/web/src/pages/HomePage.tsx:122-143`
- **Current**: Basic slate-50 boxes
- **Enhancement**: Hover effects, icons, gradient accents
- **Browse**: [Showcase Card Components](https://21st.dev/s/showcase-card)

**B. Stat Cards** (Dashboard KPIs)
- **Location**: `apps/admin/src/pages/Dashboard.tsx:186-191`
- **Current**: Basic StatCard from @munlink/ui
- **Enhancement**: Use Animated Counter component (see above)

**C. Media Cards** (Marketplace, Announcements)
- **Location**: `apps/web/src/components/MarketplaceCard.tsx`, `apps/web/src/components/AnnouncementCard.tsx`
- **Current**: Custom implementation
- **Enhancement**: Hover zoom, better image handling, skeleton loading

**Card Selection Criteria**:
1. Must work with ocean/forest/sunset gradients
2. Must be accessible (keyboard nav, ARIA labels)
3. Must be mobile responsive
4. Should have hover/active states
5. Should support loading states

**Additional Resources**: [Dashboard UI Components](https://21st.dev/community/components/s/dashboard)

---

#### 8. Form Input Components

**Browse**: [21st.dev Input Components](https://21st.dev/s/input) (102 components)

**Why Better Inputs**:
- ✅ Floating labels (modern UX)
- ✅ Better error states
- ✅ Input groups with icons
- ✅ Inline validation feedback
- ✅ Accessible focus states

**Implementation Locations**:
- `apps/web/src/pages/LoginPage.tsx` - Login form
- `apps/web/src/pages/RegisterPage.tsx` - Registration form
- `apps/web/src/pages/DocumentRequestPage.tsx` - Document request form
- `apps/admin/src/pages/Announcements.tsx` - Announcement creation

**Input Patterns to Adopt**:

**A. Floating Label Inputs**
```tsx
// Current: Label above input
<label>Email</label>
<input type="email" />

// Enhanced: Floating label
<div className="input-floating">
  <input type="email" id="email" placeholder=" " />
  <label htmlFor="email">Email</label>
</div>
```

**B. Input with Icon**
```tsx
<div className="input-group-icon">
  <SearchIcon className="input-icon-left" />
  <input type="search" placeholder="Search..." />
</div>
```

**C. Input with Validation**
```tsx
<input
  className={isValid ? "input-valid" : "input-error"}
  aria-invalid={!isValid}
  aria-describedby="error-msg"
/>
{!isValid && (
  <span id="error-msg" className="input-error-text">
    {errorMessage}
  </span>
)}
```

**Additional Resources**: [21st.dev Form Components](https://21st.dev/s/form) (23 form patterns)

---

#### 9. Navbar/Header Components

**Browse**: [21st.dev Navbar Components](https://21st.dev/s/navbar)

**Why Better Navigation**:
- ✅ Sticky header with backdrop blur
- ✅ Mega menu for services
- ✅ Better mobile menu (drawer/overlay)
- ✅ Search integration
- ✅ User dropdown menu

**Implementation Locations**:
- `apps/web/src/components/Navbar.tsx` - Public site navigation
- `apps/admin/src/components/AdminHeader.tsx` - Admin navigation

**Navbar Patterns to Consider**:

**A. Main Navigation**: [Navigation Menus Components](https://21st.dev/s/navbar-navigation) (11 components)

**B. Mobile Navigation**: [Mobile Navbar Components](https://21st.dev/community/components/s/mobile-navbar)

**C. Specific Example**: [Tubelight Navbar](https://21st.dev/ayushmxxn/tubelight-navbar)
- Modern animation effects
- Responsive design

**Features to Implement**:
```tsx
✅ Sticky header (backdrop-blur on scroll)
✅ Logo + municipality selector
✅ Main nav links (Services, Marketplace, Announcements, About)
✅ User menu (avatar + dropdown)
✅ Mobile hamburger menu
✅ Search bar (global search)
```

---

### Component Implementation Priority

#### Phase 1: Critical Admin Components (Week 1)
1. **Data Table with Filters** - Biggest impact on admin UX
2. **Animated Counter** - Polish dashboard
3. **Modern Hero** - Modernize public site

#### Phase 2: Scroll Animations (Week 2)
4. **Timeline Component** - About page enhancement
5. **Scroll Velocity** - Zambales landmarks showcase
6. **Sidebar** - Better admin navigation

#### Phase 3: Polish & Forms (Week 3)
7. **Card Components** - Consistent card styles
8. **Form Inputs** - Better form UX
9. **Navbar** - Modern navigation

---

### Component Testing Checklist

Before integrating any component, verify:

- [ ] **Design Alignment**: Uses ocean/forest/sunset gradients
- [ ] **Mobile Responsive**: Works on 375px - 1920px
- [ ] **Accessibility**: Keyboard nav, ARIA labels, focus states
- [ ] **Performance**: No jank, smooth animations
- [ ] **TypeScript**: Properly typed props
- [ ] **Dark Mode Ready**: Works with light theme (dark mode future)
- [ ] **Browser Support**: Chrome, Firefox, Safari, Edge
- [ ] **Reduced Motion**: Respects user preferences

---

### Customization Guidelines

When integrating 21st.dev components:

#### 1. Apply SerbisyoZambaleño Colors
```tsx
// Replace generic blues with ocean gradient
- className="bg-blue-500"
+ className="bg-ocean-gradient"

// Use semantic colors
- className="bg-green-500"
+ className="bg-forest-gradient" // for success
```

#### 2. Match Typography
```tsx
// Use SerbisyoZambaleño type scale
- className="text-lg font-bold"
+ className="text-fluid-xl font-semibold"
```

#### 3. Update Spacing
```tsx
// Use SerbisyoZambaleño spacing tokens
- className="p-4 gap-2"
+ className="p-6 gap-4"
```

#### 4. Add Accessibility
```tsx
// Ensure all components have proper ARIA
<button aria-label="Close menu">
  <XIcon className="w-4 h-4" aria-hidden="true" />
</button>
```

#### 5. Mobile Optimization
```tsx
// Always test on mobile and add responsive classes
<div className="
  grid-cols-1     // Mobile: 1 column
  md:grid-cols-2  // Tablet: 2 columns
  lg:grid-cols-3  // Desktop: 3 columns
">
```

---

## Scroll Animations

SerbisyoZambaleño uses scroll-based animations to create engaging, dynamic experiences while maintaining performance and accessibility. These animations are **mobile-responsive** and respect user preferences.

### Selected Components from 21st.dev

#### 1. **Timeline Component** (About Page - Public Records & History)

**Source**: [Aceternity Timeline](https://21st.dev/community/components/aceternity/timeline/default)

**Use Cases**:
- About page: Display SerbisyoZambaleño's development timeline
- About page: Show municipality onboarding history
- About page: Document request process visualization
- Public records section: Step-by-step guide flow

**Implementation Location**: `apps/web/src/pages/About.tsx`

**Features**:
- ✅ Vertical timeline with scroll-triggered animations
- ✅ Content reveals as user scrolls
- ✅ Smooth fade-in + slide-up effects
- ✅ Mobile-responsive (stacks vertically)

**Mobile Responsiveness**:
```tsx
// Desktop: Side-by-side timeline with animated line
// Mobile: Single column, smaller timeline dots, compact spacing

<div className="timeline-container">
  {/* Desktop: 2-column layout with center line */}
  <div className="hidden md:grid md:grid-cols-[1fr_40px_1fr] gap-8">
    <TimelineItem side="left" />
    <TimelineItem side="right" />
  </div>

  {/* Mobile: Single column with left-aligned line */}
  <div className="md:hidden space-y-6">
    <TimelineItem compact />
  </div>
</div>
```

**Animation Behavior**:
- **Desktop**: Items fade in from left/right alternating
- **Mobile**: Items fade in from bottom, uniform direction
- **Trigger**: When 20% of item enters viewport
- **Duration**: 400ms ease-out
- **Respects**: `prefers-reduced-motion`

---

#### 2. **Scroll Velocity Component** (Zambales Landmarks Showcase)

**Source**: [Edil-ozi Scroll Velocity](https://21st.dev/community/components/Edil-ozi/scroll-velocity/default)

**Use Cases**:
- About page: Showcase all 13 Zambales municipalities
- Home page: Display landmark images from `public/landmarks/zambales/`
- Footer: Continuous scroll of province highlights

**Implementation Location**:
- `apps/web/src/pages/About.tsx` (Municipalities section)
- `apps/web/src/pages/HomePage.tsx` (Optional hero decoration)

**Features**:
- ✅ Infinite horizontal scroll
- ✅ Speed responds to user scroll velocity
- ✅ Smooth, performant (uses CSS transforms)
- ✅ Duplicates content seamlessly
- ✅ Mobile-responsive (adjusts speed and size)

**Landmark Integration**:
```tsx
// Use existing landmark images from public/landmarks/zambales/
const zambalesMunicipalities = [
  { name: 'Botolan', image: '/landmarks/zambales/botolan/landmark.jpg' },
  { name: 'Cabangan', image: '/landmarks/zambales/cabangan/landmark.jpg' },
  { name: 'Candelaria', image: '/landmarks/zambales/candelaria/landmark.jpg' },
  // ... all 13 municipalities
]

<ScrollVelocity baseVelocity={-1}>
  {zambalesMunicipalities.map((mun) => (
    <div className="scroll-velocity-item" key={mun.name}>
      <img src={mun.image} alt={`${mun.name} landmark`} />
      <span>{mun.name}</span>
    </div>
  ))}
</ScrollVelocity>
```

**Mobile Responsiveness**:
```css
/* Desktop: Larger images, faster scroll */
.scroll-velocity-item {
  @apply w-64 h-40 md:w-80 md:h-48;
}

/* Mobile: Smaller images, slower scroll, larger tap targets */
@media (max-width: 768px) {
  .scroll-velocity-wrapper {
    --base-velocity: 0.5; /* Half speed on mobile */
  }

  .scroll-velocity-item {
    @apply w-48 h-32; /* Smaller cards */
  }
}

/* Touch devices: Reduce motion sensitivity */
@media (hover: none) and (pointer: coarse) {
  .scroll-velocity-wrapper {
    --scroll-multiplier: 0.3; /* Less reactive to touch scroll */
  }
}
```

**Performance Optimization**:
- Uses `will-change: transform` for GPU acceleration
- Lazy loads images outside viewport
- Pauses animation when tab is inactive
- Reduces velocity on low-power devices

---

#### 3. **Modern Hero** (About Page Hero Section)

**Source**: [Uniquesonu Modern Hero](https://21st.dev/community/components/uniquesonu/modern-hero/default)

**Use Cases**:
- About page: Replace current hero with modern animated version
- Home page: Enhanced hero with parallax and gradient animations

**Implementation Location**: `apps/web/src/pages/About.tsx:39-69`

**Features**:
- ✅ Animated gradient background
- ✅ Parallax scroll effect on background
- ✅ Floating elements/particles (optional)
- ✅ Smooth text reveal animations
- ✅ CTA button interactions
- ✅ Mobile-responsive (simplified on small screens)

**Mobile Responsiveness**:
```tsx
// Desktop: Full parallax, gradient animations, floating elements
// Mobile: Static gradient, simplified animations, larger touch targets

<section className="modern-hero">
  {/* Background gradient (animated on desktop only) */}
  <div className="hero-gradient">
    <div className="hidden md:block hero-gradient-animated" />
    <div className="md:hidden hero-gradient-static" />
  </div>

  {/* Parallax background image (desktop only) */}
  <div className="hidden md:block hero-parallax" data-scroll-speed="0.5">
    <img src={heroImage} alt="" />
  </div>

  {/* Static background for mobile */}
  <div className="md:hidden hero-bg-static">
    <img src={heroImage} alt="" />
  </div>

  {/* Content - responsive text sizes */}
  <div className="hero-content">
    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl">
      About SerbisyoZambaleño Zambales
    </h1>
  </div>
</section>
```

**Animation Behavior**:
- **Desktop**:
  - Parallax: Background scrolls at 50% speed
  - Gradient: Animated 8s infinite color shift
  - Floating elements: Gentle vertical float
  - Text: Fade in + slide up (500ms)

- **Mobile**:
  - No parallax (performance)
  - Static gradient (battery saving)
  - No floating elements (cleaner)
  - Simplified text fade-in (300ms)

**Accessibility for Modern Hero**:
```tsx
// Disable animations for users with motion sensitivity
@media (prefers-reduced-motion: reduce) {
  .hero-gradient-animated,
  .hero-parallax,
  .hero-floating-elements {
    animation: none !important;
    transform: none !important;
  }

  .hero-content {
    opacity: 1; /* Show immediately, no fade */
    transform: translateY(0);
  }
}
```

---

### Scroll Animation Implementation Guidelines

#### 1. **Mobile-First Approach**

Always build animations mobile-first, then enhance for desktop:

```tsx
// ❌ Wrong: Desktop-first (mobile gets complex animations)
<div className="animate-parallax md:animate-none">

// ✅ Correct: Mobile-first (desktop gets enhancements)
<div className="animate-fade-in md:animate-parallax">
```

#### 2. **Performance Budget**

| Device Type | Max Concurrent Scroll Animations | Frame Rate Target |
|-------------|----------------------------------|-------------------|
| Desktop | 5-7 elements | 60fps |
| Tablet | 3-4 elements | 60fps |
| Mobile | 2-3 elements | 60fps (30fps acceptable) |
| Low-power mode | 1-2 elements | 30fps |

#### 3. **Intersection Observer Pattern**

Use for all scroll-triggered animations:

```tsx
import { useEffect, useRef, useState } from 'react'

function useScrollAnimation(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          // Optional: Unobserve after first trigger
          observer.unobserve(entry.target)
        }
      },
      {
        threshold, // Trigger when 20% visible
        rootMargin: '0px 0px -10% 0px' // Trigger slightly before reaching viewport center
      }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [threshold])

  return { ref, isVisible }
}

// Usage
function AnimatedSection() {
  const { ref, isVisible } = useScrollAnimation(0.2)

  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-8'
      }`}
    >
      Content reveals on scroll
    </div>
  )
}
```

#### 4. **Reduced Motion Support**

**Critical**: Always respect user preferences:

```tsx
// Detect reduced motion preference
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches

// Conditionally apply animations
<div className={prefersReducedMotion ? 'animate-none' : 'animate-scroll-reveal'}>
```

**Global CSS for reduced motion**:
```css
@media (prefers-reduced-motion: reduce) {
  /* Disable all scroll animations */
  .scroll-animate,
  .scroll-velocity,
  .parallax-bg,
  .timeline-animate {
    animation: none !important;
    transition: none !important;
    transform: none !important;
  }

  /* Show all content immediately */
  .scroll-reveal {
    opacity: 1 !important;
    transform: translateY(0) !important;
  }
}
```

#### 5. **Mobile-Specific Optimizations**

```tsx
// Detect mobile devices
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
const isTouchDevice = 'ontouchstart' in window

// Simplify animations on mobile
<ScrollVelocity
  baseVelocity={isMobile ? 0.5 : 1.0}
  disableParallax={isMobile}
/>

<Timeline
  itemsPerView={isMobile ? 1 : 3}
  compactMode={isMobile}
/>

<ModernHero
  enableParallax={!isMobile}
  enableFloatingElements={!isMobile}
  animationDuration={isMobile ? 300 : 500}
/>
```

#### 6. **Responsive Breakpoints for Animations**

```tsx
// Animation complexity based on screen size
const animationConfig = {
  mobile: {
    duration: 300,
    distance: '20px',
    stagger: 0,
    enableParallax: false
  },
  tablet: {
    duration: 400,
    distance: '40px',
    stagger: 50,
    enableParallax: false
  },
  desktop: {
    duration: 500,
    distance: '60px',
    stagger: 100,
    enableParallax: true
  }
}

// Usage with Tailwind breakpoints
<div
  className="
    animate-fade-in
    md:animate-slide-up
    lg:animate-parallax
  "
  style={{
    animationDuration: `${isMobile ? 300 : 500}ms`
  }}
>
```

---

### Scroll Animation Component Catalog

| Component | Source | Page | Mobile Strategy | Performance Impact |
|-----------|--------|------|----------------|-------------------|
| **Timeline** | [Aceternity](https://21st.dev/community/components/aceternity/timeline/default) | About | Stack vertically, simplify line | Low |
| **Scroll Velocity** | [Edil-ozi](https://21st.dev/community/components/Edil-ozi/scroll-velocity/default) | About, Home | Reduce speed, smaller items | Medium |
| **Modern Hero** | [Uniquesonu](https://21st.dev/community/components/uniquesonu/modern-hero/default) | About, Home | Disable parallax, static gradient | Medium-High |
| **Fade In** | Built-in | All pages | Same on all devices | Very Low |
| **Slide Up** | Built-in | All pages | Reduce distance on mobile | Low |

---

### Testing Scroll Animations

#### Checklist for Each Scroll Animation

- [ ] **Desktop (1920x1080)**: Smooth 60fps, full effects enabled
- [ ] **Laptop (1440x900)**: Smooth 60fps, full effects enabled
- [ ] **Tablet (768x1024)**: Smooth 60fps, simplified effects
- [ ] **Mobile (375x667)**: Smooth 30-60fps, minimal effects
- [ ] **Reduced Motion**: All animations disabled, content visible
- [ ] **Slow 3G**: Animations don't block content loading
- [ ] **Touch Devices**: No jank during scroll, proper touch handling
- [ ] **Safari iOS**: No webkit-specific bugs
- [ ] **Chrome Android**: Smooth performance
- [ ] **Low-power mode**: Reduced animation complexity

#### Performance Profiling

```bash
# Test scroll performance with Lighthouse
npm run build
# Open Chrome DevTools > Lighthouse > Desktop/Mobile
# Check "Performance" category, look for:
# - Total Blocking Time < 300ms
# - Cumulative Layout Shift < 0.1
# - First Contentful Paint < 2s

# Test on real devices
# Use Chrome DevTools > Performance > Record while scrolling
# Look for frame drops (below 60fps green line)
```

---

### Common Scroll Animation Patterns

#### Pattern 1: Fade + Slide Up (Universal)

```tsx
// Use for: Cards, sections, content blocks
<div className="
  opacity-0 translate-y-8
  transition-all duration-500 ease-out
  [&.in-view]:opacity-100 [&.in-view]:translate-y-0
  md:duration-700 md:translate-y-12
">
  Content
</div>
```

#### Pattern 2: Staggered Children

```tsx
// Use for: Lists, grids, multiple cards
<div className="space-y-4">
  {items.map((item, i) => (
    <div
      key={item.id}
      className="animate-fade-in"
      style={{
        animationDelay: `${i * 100}ms`,
        // Mobile: Reduce stagger
        animationDelay: isMobile ? `${i * 50}ms` : `${i * 100}ms`
      }}
    >
      {item.content}
    </div>
  ))}
</div>
```

#### Pattern 3: Parallax Background (Desktop Only)

```tsx
// Use for: Hero sections, large images
<div className="relative overflow-hidden">
  {/* Mobile: Static background */}
  <div className="md:hidden absolute inset-0">
    <img src={bg} className="object-cover w-full h-full" />
  </div>

  {/* Desktop: Parallax background */}
  <div
    className="hidden md:block absolute inset-0"
    style={{
      transform: `translateY(${scrollY * 0.5}px)`
    }}
  >
    <img src={bg} className="object-cover w-full h-[120%]" />
  </div>

  <div className="relative z-10">
    Content
  </div>
</div>
```

#### Pattern 4: Scroll Progress Indicator

```tsx
// Use for: Long articles, documentation pages
<div className="fixed top-0 left-0 right-0 h-1 bg-gray-200 z-50">
  <div
    className="h-full bg-ocean-gradient transition-all"
    style={{
      width: `${scrollProgress}%`,
      // Smooth on desktop, instant on mobile
      transition: isMobile ? 'none' : 'width 0.1s ease-out'
    }}
  />
</div>
```

---

### Zambales Landmark Images Integration

For the Scroll Velocity component, use the existing landmark images:

```tsx
// Location: public/landmarks/zambales/[municipality-slug]/
// Structure:
// - botolan/
// - cabangan/
// - candelaria/
// - castillejos/
// - iba/
// - masinloc/
// - palauig/
// - san-antonio/
// - san-felipe/
// - san-marcelino/
// - san-narciso/
// - santa-cruz/
// - subic/

// Implementation in About.tsx or HomePage.tsx
import { ZAMBALES_MUNICIPALITIES } from '@/lib/locations'

const municipalityImages = ZAMBALES_MUNICIPALITIES.map(mun => ({
  name: mun.name,
  slug: mun.slug,
  image: `/landmarks/zambales/${mun.slug}/landmark.jpg`,
  // Fallback if no landmark image exists
  fallback: `/logos/municipalities/${mun.slug}.png`
}))

<ScrollVelocity baseVelocity={-1} className="my-12">
  <div className="flex gap-6 md:gap-8">
    {municipalityImages.map((mun) => (
      <div
        key={mun.slug}
        className="
          flex-shrink-0
          w-48 h-32
          md:w-64 md:h-40
          rounded-xl overflow-hidden
          shadow-lg hover:shadow-xl
          transition-shadow
        "
      >
        <img
          src={mun.image}
          alt={`${mun.name} landmark`}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to municipality logo if image fails
            e.currentTarget.src = mun.fallback
          }}
        />
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-3">
          <span className="text-white font-medium text-sm md:text-base">
            {mun.name}
          </span>
        </div>
      </div>
    ))}
  </div>
</ScrollVelocity>
```

---

### Animation Decision Matrix

Use this to decide which animation to apply:

```
Is it a hero section?
  → Modern Hero (desktop: parallax, mobile: static gradient)

Is it a timeline/process?
  → Timeline Component (desktop: side-by-side, mobile: vertical stack)

Is it a continuous showcase (municipalities, features)?
  → Scroll Velocity (desktop: fast, mobile: slow + smaller)

Is it a content section entering viewport?
  → Fade + Slide Up (desktop: larger distance, mobile: smaller)

Is it multiple related items?
  → Staggered Children (desktop: 100ms stagger, mobile: 50ms)

Is it background imagery?
  → Parallax (desktop only, mobile: static)
```

---

## Accessibility

### Focus States

All interactive elements MUST have visible focus indicators:

```css
/* Applied globally in index.css */
*:focus-visible {
  @apply outline-none ring-2 ring-sky-500 ring-offset-2;
}
```

### Keyboard Navigation

- All buttons and links must be keyboard accessible (use semantic HTML)
- Modals must trap focus and restore focus on close
- Skip links for screen reader users
- Tab order follows visual hierarchy

### Color Contrast

All text must meet WCAG AA standards:

- **Normal text**: 4.5:1 contrast ratio minimum
- **Large text** (18px+): 3:1 contrast ratio minimum
- Use tools like [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

#### Approved Text Color Combinations

```tsx
// White backgrounds
text-slate-900 on bg-white  ✅ (16.1:1)
text-slate-800 on bg-white  ✅ (12.6:1)
text-slate-700 on bg-white  ✅ (9.5:1)
text-slate-600 on bg-white  ✅ (7.1:1)
text-slate-500 on bg-white  ✅ (4.6:1)
text-slate-400 on bg-white  ⚠️ (2.9:1 - use for disabled only)

// Dark backgrounds
text-white on bg-ocean-gradient  ✅ (4.8:1)
text-white on bg-forest-gradient ✅ (5.2:1)
text-white on bg-slate-900      ✅ (16.1:1)
```

### ARIA Labels

```tsx
// Icon-only buttons
<button className="icon-btn" aria-label="Edit profile">
  <PencilIcon className="w-4 h-4" />
</button>

// Status indicators
<span className="status-dot status-dot-success" aria-label="Active" />

// Loading states
<button className="btn-primary" disabled aria-busy="true">
  <SpinnerIcon className="animate-spin" aria-hidden="true" />
  Loading...
</button>

// Modal
<div role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <h2 id="modal-title">Confirm Action</h2>
</div>
```

### Screen Reader Considerations

```tsx
// Hide decorative icons from screen readers
<StarIcon className="w-5 h-5" aria-hidden="true" />

// Provide meaningful text alternatives
<img src={logo} alt="SerbisyoZambaleño Zambales Logo" />

// Use semantic HTML
<nav aria-label="Main navigation">
<main aria-label="Main content">
<aside aria-label="Filters">

// Announce dynamic changes
<div role="status" aria-live="polite">
  {successMessage}
</div>
```

---

## Implementation Guide

### Component Creation Checklist

When creating a new component, ensure:

- [ ] Uses design system tokens (colors, spacing, typography)
- [ ] Has hover/focus/active states
- [ ] Includes loading and error states (if applicable)
- [ ] Responsive on mobile, tablet, desktop
- [ ] Keyboard accessible
- [ ] Screen reader friendly (ARIA labels)
- [ ] Follows naming conventions (PascalCase for components)
- [ ] Documented with TypeScript types
- [ ] Uses existing components from `apps/*/components/ui/` when possible

### Adding New Colors

1. Add CSS variable to `:root` in `apps/web/src/index.css`
2. Add Tailwind utility class in `@layer utilities`
3. Document in this file under [Color System](#color-system)
4. Update color usage rules with semantic meaning

### Adding New Components

1. Check if similar component exists in `apps/web/src/components/ui/`
2. If reusable, create in `apps/web/src/components/ui/` (not `packages/ui` yet)
3. Use existing patterns (see [Components](#components) section)
4. Add TypeScript types for all props
5. Document usage in this file
6. Test on multiple screen sizes
7. Verify keyboard and screen reader accessibility

### Design System Maintenance

**Who Updates This File?**
- Developers when adding new reusable patterns
- Designers when establishing new design tokens
- Before merging significant UI changes

**When to Update?**
- New color added to brand palette
- New component pattern established
- Accessibility guidelines changed
- Typography scale adjusted
- New animation pattern introduced

---

## Quick Reference

### Common Patterns Cheat Sheet

```tsx
// Hero Section
<section className="relative h-[50vh] min-h-[360px] w-full overflow-hidden">
  <img src={bg} className="absolute inset-0 w-full h-full object-cover" />
  <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/50" />
  <div className="relative z-10 h-full flex items-center">
    <div className="container-responsive">
      <h1 className="text-white text-4xl md:text-5xl lg:text-6xl font-semibold">
        Hero Title
      </h1>
    </div>
  </div>
</section>

// Section Container
<section className="py-16 md:py-20">
  <div className="container-responsive">
    <h2 className="text-3xl md:text-4xl font-semibold text-slate-900 mb-8">
      Section Title
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Grid content */}
    </div>
  </div>
</section>

// Stat Card
<div className="card p-6">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm text-slate-600 font-medium">Label</p>
      <p className="text-3xl font-semibold text-slate-900 mt-1">1,234</p>
    </div>
    <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center">
      <Icon className="w-6 h-6 text-sky-600" />
    </div>
  </div>
</div>

// Form Row
<div className="input-group">
  <label className="input-label">Label</label>
  <input className="input-field" placeholder="Placeholder..." />
</div>

// Action Buttons
<div className="flex items-center gap-3">
  <button className="btn-secondary">Cancel</button>
  <button className="btn-primary">Confirm</button>
</div>

// Status Badge
<span className="pill-success">Verified</span>

// Loading State
<div className="skeleton-card p-6">
  <div className="skeleton-heading mb-3" />
  <div className="skeleton-text" />
</div>
```

---

## Resources

### Internal
- Web App CSS: `apps/web/src/index.css`
- Admin CSS: `apps/admin/src/index.css`
- UI Components: `apps/web/src/components/ui/`
- Shared UI: `packages/ui/src/` (to be established)

### External
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Inclusive Components](https://inclusive-components.design/)
- [21st.dev Component Library](https://21st.dev/components) - For inspiration
- [Framer Motion Docs](https://www.framer.com/motion/) - Animation library used in scroll components

### Selected 21st.dev Components
- [Aceternity Timeline](https://21st.dev/community/components/aceternity/timeline/default) - Timeline for About page
- [Edil-ozi Scroll Velocity](https://21st.dev/community/components/Edil-ozi/scroll-velocity/default) - Zambales landmarks showcase
- [Uniquesonu Modern Hero](https://21st.dev/community/components/uniquesonu/modern-hero/default) - Animated hero sections
- [Data Table with Filters](https://21st.dev/community/components/originui/table/data-table-with-filters-made-with-tan-stack-table) - Admin tables
- [Animated Counter](https://21st.dev/builduilabs/animated-counter/default) - Dashboard stat cards
- [Aceternity Sidebar](https://21st.dev/aceternity/sidebar) - Admin navigation

### Tools
- [Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Coolors Palette Generator](https://coolors.co/)
- [Tailwind Play (Sandbox)](https://play.tailwindcss.com/)
- [Chrome DevTools Performance Monitor](https://developer.chrome.com/docs/devtools/performance/) - Test scroll animations

---

**Last Updated**: 2026-01-29 (Added Scroll Animations section)
**Maintained By**: SerbisyoZambaleño Development Team
**Questions?** Open an issue or contact the design lead.

---

*This design system is a living document. Keep it updated, keep it consistent, keep it accessible.*
