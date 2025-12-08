# GitBook Setup Instructions

This guide explains how to set up and publish your LancerFi GitBook documentation.

## What is GitBook?

GitBook is a modern documentation platform that makes it easy to create and publish beautiful documentation. You can host it on GitBook's platform or self-host it.

## Option 1: GitBook Cloud (Recommended)

### Step 1: Create GitBook Account

1. Go to [gitbook.com](https://www.gitbook.com/)
2. Sign up for a free account
3. Verify your email

### Step 2: Create a New Space

1. Click "Create" → "New Space"
2. Choose "Import from GitHub" or "Start from scratch"
3. If importing from GitHub:
   - Connect your GitHub account
   - Select the `LancerFinance/LancerFi` repository
   - Choose the `gitbook` folder

### Step 3: Configure Your Space

1. **Name**: LancerFi Documentation
2. **URL**: lancerfi.gitbook.io (or your custom domain)
3. **Visibility**: Public (or Private if preferred)

### Step 4: Set Up Structure

1. GitBook will automatically detect `SUMMARY.md`
2. The structure from `SUMMARY.md` will create your navigation
3. All markdown files will be rendered as pages

### Step 5: Customize

1. **Theme**: Choose a theme in Settings → Appearance
2. **Logo**: Upload LancerFi logo
3. **Colors**: Customize brand colors
4. **Domain**: Set up custom domain if desired

### Step 6: Publish

1. Click "Publish" in the top right
2. Your documentation will be live at `lancerfi.gitbook.io`

## Option 2: Self-Hosted GitBook

### Using GitBook CLI

```bash
# Install GitBook CLI
npm install -g gitbook-cli

# Navigate to gitbook directory
cd gitbook

# Install GitBook dependencies
gitbook install

# Serve locally
gitbook serve

# Build static site
gitbook build
```

### Deploy to GitHub Pages

```bash
# Build the book
gitbook build

# Deploy to GitHub Pages
# Copy _book contents to gh-pages branch
```

## Option 3: GitHub Integration

### Connect GitHub Repository

1. In GitBook, go to Settings → Integrations
2. Connect your GitHub account
3. Select the repository
4. Choose sync settings:
   - **Branch**: main (or your default branch)
   - **Path**: gitbook/
   - **Auto-sync**: Enable for automatic updates

### Automatic Updates

When you push changes to the `gitbook/` folder:
- GitBook will automatically sync
- Changes will be published automatically
- No manual intervention needed

## Customization

### Add Custom Domain

1. Go to Settings → Domains
2. Add your custom domain (e.g., docs.lancerfi.app)
3. Follow DNS configuration instructions
4. Enable SSL certificate

### Customize Appearance

1. **Logo**: Upload in Settings → Branding
2. **Colors**: Customize in Settings → Appearance
3. **Fonts**: Choose fonts in Settings → Appearance
4. **Layout**: Adjust in Settings → Layout

### Add Search

GitBook includes built-in search functionality. To enhance it:
1. Enable search in Settings → Features
2. Configure search settings
3. Add search keywords to pages

## Content Management

### Adding New Pages

1. Create a new `.md` file in the appropriate directory
2. Add it to `SUMMARY.md` in the correct location
3. Commit and push to GitHub
4. GitBook will automatically update

### Editing Existing Pages

1. Edit the `.md` file directly
2. Commit and push changes
3. GitBook will sync automatically

### Images and Assets

1. Create an `assets/` folder in `gitbook/`
2. Reference images: `![Alt text](assets/image.png)`
3. GitBook will host the images

## Best Practices

### Writing Documentation

- Use clear, concise language
- Include code examples where relevant
- Add screenshots for complex processes
- Keep pages focused on single topics
- Use proper markdown formatting

### Organization

- Follow the structure in `SUMMARY.md`
- Group related topics together
- Use descriptive page titles
- Add cross-references between pages

### Maintenance

- Keep documentation up to date
- Review and update regularly
- Add new features to documentation
- Remove outdated information

## Troubleshooting

### Sync Issues

If GitBook doesn't sync automatically:
1. Check GitHub integration settings
2. Verify branch and path are correct
3. Manually trigger sync in GitBook

### Formatting Issues

- Ensure proper markdown syntax
- Check for special characters
- Verify image paths are correct

### Build Errors

- Check markdown syntax
- Verify all files in SUMMARY.md exist
- Check for broken links

## Next Steps

1. Set up your GitBook account
2. Import or create your space
3. Configure settings and appearance
4. Publish your documentation
5. Share the link: `https://lancerfi.gitbook.io`

## Support

- GitBook Documentation: [docs.gitbook.com](https://docs.gitbook.com/)
- GitBook Community: [community.gitbook.com](https://community.gitbook.com/)
- LancerFi GitHub: [github.com/LancerFinance/LancerFi](https://github.com/LancerFinance/LancerFi)

