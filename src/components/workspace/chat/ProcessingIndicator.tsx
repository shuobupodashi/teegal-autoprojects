import React, { useState, useEffect } from "react";
import { Lightbulb } from "lucide-react";

const ProcessingIndicator = () => {
  return (
    <div className="flex justify-start mb-4">
      <div className="bg-gray-100 text-gray-800 px-4 py-3 rounded-lg flex items-center space-x-2">
        {/* 三个点动态加载效果 */}
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"></div>
        </div>
      </div>
    </div>
  );
};

export default ProcessingIndicator;
