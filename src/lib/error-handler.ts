import { toast } from "@/hooks/use-toast";

interface ErrorInfo {
  title: string;
  message: string;
  action?: string;
}

export const getErrorInfo = (error: any): ErrorInfo => {
  // Handle Supabase errors
  if (error?.code) {
    switch (error.code) {
      case '23505':
        if (error.message.includes('profiles_wallet_address_key')) {
          return {
            title: "Profile Already Exists",
            message: "A profile is already linked to this wallet address.",
            action: "Please refresh the page and try again."
          };
        }
        if (error.message.includes('profiles_username_key')) {
          return {
            title: "Username Taken",
            message: "This username is already in use.",
            action: "Please choose a different username."
          };
        }
        return {
          title: "Duplicate Entry",
          message: "This information already exists in the system.",
          action: "Please check your input and try again."
        };
      
      case '23503':
        return {
          title: "Invalid Reference",
          message: "Referenced data does not exist.",
          action: "Please refresh the page and try again."
        };
      
      case '42501':
        return {
          title: "Permission Denied",
          message: "You don't have permission to perform this action.",
          action: "Please make sure you're connected with the correct wallet."
        };
      
      case 'PGRST301':
        return {
          title: "Authentication Required",
          message: "You need to be logged in to perform this action.",
          action: "Please connect your wallet and try again."
        };
      
      case 'PGRST116':
        return {
          title: "Not Found",
          message: "The requested information was not found.",
          action: "Please check if the data exists and try again."
        };
      
      default:
        return {
          title: "Database Error",
          message: error.message || "A database error occurred.",
          action: "Please try again later."
        };
    }
  }

  // Handle network errors
  if (error?.message?.includes('fetch')) {
    return {
      title: "Connection Error",
      message: "Unable to connect to the server.",
      action: "Please check your internet connection and try again."
    };
  }

  // Handle wallet errors
  if (error?.message?.includes('wallet')) {
    return {
      title: "Wallet Error",
      message: error.message || "A wallet error occurred.",
      action: "Please check your wallet connection and try again."
    };
  }

  // Handle validation errors
  if (error?.message?.includes('validation') || error?.message?.includes('invalid')) {
    return {
      title: "Validation Error",
      message: error.message || "Please check your input.",
      action: "Correct the highlighted fields and try again."
    };
  }

  // Handle timeout errors
  if (error?.message?.includes('timeout')) {
    return {
      title: "Request Timeout",
      message: "The request took too long to complete.",
      action: "Please try again in a moment."
    };
  }

  // Generic error handling
  return {
    title: "Unexpected Error",
    message: error?.message || "Something went wrong.",
    action: "Please try again or contact support if the problem persists."
  };
};

export const handleError = (error: any, customTitle?: string): void => {
  console.error('Application error:', error);
  
  const errorInfo = getErrorInfo(error);
  
  const title = customTitle || errorInfo.title;
  const description = errorInfo.action 
    ? `${errorInfo.message} ${errorInfo.action}`
    : errorInfo.message;
  
  toast({
    title,
    description,
    variant: "destructive"
  });
};

export const handleSuccess = (title: string, message: string): void => {
  toast({
    title,
    description: message,
  });
};