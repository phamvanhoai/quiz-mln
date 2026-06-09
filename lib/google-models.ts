export const googleAiModels = [
  { label: "Gemini 2.5 Flash", value: "gemini-2.5-flash" },
  { label: "Gemini 2.5 Pro", value: "gemini-2.5-pro" },
  { label: "Gemini 2.0 Flash", value: "gemini-2.0-flash" },
  { label: "Gemini 2.0 Flash 001", value: "gemini-2.0-flash-001" },
  { label: "Gemini 2.0 Flash-Lite 001", value: "gemini-2.0-flash-lite-001" },
  { label: "Gemini 2.0 Flash-Lite", value: "gemini-2.0-flash-lite" },
  { label: "Gemma 4 26B A4B IT", value: "gemma-4-26b-a4b-it" },
  { label: "Gemma 4 31B IT", value: "gemma-4-31b-it" },
  { label: "Gemini Flash Latest", value: "gemini-flash-latest" },
  { label: "Gemini Flash-Lite Latest", value: "gemini-flash-lite-latest" },
  { label: "Gemini Pro Latest", value: "gemini-pro-latest" },
  { label: "Gemini 2.5 Flash-Lite", value: "gemini-2.5-flash-lite" },
  { label: "Nano Banana", value: "gemini-2.5-flash-image" },
  { label: "Gemini 3 Pro Preview", value: "gemini-3-pro-preview" },
  { label: "Gemini 3 Flash Preview", value: "gemini-3-flash-preview" },
  { label: "Gemini 3.1 Pro Preview", value: "gemini-3.1-pro-preview" },
  { label: "Gemini 3.1 Pro Preview Custom Tools", value: "gemini-3.1-pro-preview-customtools" },
  { label: "Gemini 3.1 Flash Lite Preview", value: "gemini-3.1-flash-lite-preview" },
  { label: "Gemini 3.1 Flash Lite", value: "gemini-3.1-flash-lite" },
  { label: "Nano Banana Pro", value: "gemini-3-pro-image-preview" }
];

export function getGoogleModelLabel(value: string) {
  const model = googleAiModels.find((item) => item.value === value);
  return model ? `${model.label} (${model.value})` : value;
}
