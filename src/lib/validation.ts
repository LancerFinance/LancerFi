export interface ValidationError {
  field: string;
  message: string;
}

export const validateProject = (formData: {
  title: string;
  category: string; 
  description: string;
  budget: string;
  timeline: string;
  skills: string;
}): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Title validation
  if (!formData.title.trim()) {
    errors.push({ field: 'title', message: 'Project title is required' });
  } else if (formData.title.length < 10) {
    errors.push({ field: 'title', message: 'Title must be at least 10 characters' });
  } else if (formData.title.length > 100) {
    errors.push({ field: 'title', message: 'Title cannot exceed 100 characters' });
  }

  // Category validation
  if (!formData.category) {
    errors.push({ field: 'category', message: 'Project category is required' });
  }

  // Description validation
  if (!formData.description.trim()) {
    errors.push({ field: 'description', message: 'Project description is required' });
  } else if (formData.description.length < 50) {
    errors.push({ field: 'description', message: 'Description must be at least 50 characters' });
  } else if (formData.description.length > 5000) {
    errors.push({ field: 'description', message: 'Description cannot exceed 5000 characters' });
  }

  // Budget validation
  const budget = parseFloat(formData.budget);
  if (!formData.budget.trim()) {
    errors.push({ field: 'budget', message: 'Budget is required' });
  } else if (isNaN(budget) || budget <= 0) {
    errors.push({ field: 'budget', message: 'Budget must be a positive number' });
  } else if (budget < 10) {
    errors.push({ field: 'budget', message: 'Minimum budget is $10 USDC' });
  } else if (budget > 1000000) {
    errors.push({ field: 'budget', message: 'Maximum budget is $1,000,000 USDC' });
  }

  // Timeline validation
  if (!formData.timeline) {
    errors.push({ field: 'timeline', message: 'Timeline is required' });
  }

  // Skills validation
  if (!formData.skills.trim()) {
    errors.push({ field: 'skills', message: 'At least one skill is required' });
  } else {
    const skillsList = formData.skills.split(',').map(s => s.trim()).filter(Boolean);
    if (skillsList.length === 0) {
      errors.push({ field: 'skills', message: 'At least one skill is required' });
    } else if (skillsList.length > 10) {
      errors.push({ field: 'skills', message: 'Maximum 10 skills allowed' });
    }
  }

  return errors;
};

export const validateProfile = (profileData: {
  full_name: string;
  username: string;
  bio: string;
  hourly_rate: string;
  portfolio_url: string;
}): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Full name validation
  if (!profileData.full_name.trim()) {
    errors.push({ field: 'full_name', message: 'Full name is required' });
  } else if (profileData.full_name.length < 2) {
    errors.push({ field: 'full_name', message: 'Name must be at least 2 characters' });
  } else if (profileData.full_name.length > 50) {
    errors.push({ field: 'full_name', message: 'Name cannot exceed 50 characters' });
  }

  // Username validation
  if (!profileData.username.trim()) {
    errors.push({ field: 'username', message: 'Username is required' });
  } else if (profileData.username.length < 3) {
    errors.push({ field: 'username', message: 'Username must be at least 3 characters' });
  } else if (profileData.username.length > 30) {
    errors.push({ field: 'username', message: 'Username cannot exceed 30 characters' });
  } else if (!/^[a-zA-Z0-9_-]+$/.test(profileData.username)) {
    errors.push({ field: 'username', message: 'Username can only contain letters, numbers, hyphens, and underscores' });
  }

  // Bio validation
  if (!profileData.bio.trim()) {
    errors.push({ field: 'bio', message: 'Bio is required' });
  } else if (profileData.bio.length < 20) {
    errors.push({ field: 'bio', message: 'Bio must be at least 20 characters' });
  } else if (profileData.bio.length > 1000) {
    errors.push({ field: 'bio', message: 'Bio cannot exceed 1000 characters' });
  }

  // Hourly rate validation
  if (profileData.hourly_rate.trim()) {
    const rate = parseFloat(profileData.hourly_rate);
    if (isNaN(rate) || rate < 0) {
      errors.push({ field: 'hourly_rate', message: 'Hourly rate must be a positive number' });
    } else if (rate > 1000) {
      errors.push({ field: 'hourly_rate', message: 'Maximum hourly rate is $1000' });
    }
  }

  // Portfolio URL validation
  if (profileData.portfolio_url.trim()) {
    try {
      new URL(profileData.portfolio_url);
    } catch {
      errors.push({ field: 'portfolio_url', message: 'Please enter a valid URL' });
    }
  }

  return errors;
};

export const validateMessage = (content: string, subject?: string): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!content.trim()) {
    errors.push({ field: 'content', message: 'Message content is required' });
  } else if (content.length < 10) {
    errors.push({ field: 'content', message: 'Message must be at least 10 characters' });
  } else if (content.length > 2000) {
    errors.push({ field: 'content', message: 'Message cannot exceed 2000 characters' });
  }

  if (subject && subject.length > 100) {
    errors.push({ field: 'subject', message: 'Subject cannot exceed 100 characters' });
  }

  return errors;
};