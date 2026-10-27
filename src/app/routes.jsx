import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader, Center } from '@mantine/core';
import MainLayout from './layout/MainLayout';

const Loading = () => <Center h="60vh"><Loader size="lg" /></Center>;
const wrap = (C) => <Suspense fallback={<Loading />}><C /></Suspense>;

// Consolidated Studios
const ImageStudio = lazy(() => import('@/features/image-tools/ImageStudio'));
const JsonStudio = lazy(() => import('@/features/code-tools/json-studio/JsonStudio'));

// Individual Code Tools
const XmlTools = lazy(() => import('@/features/code-tools/xml-tools/XmlTools'));
const YamlTools = lazy(() => import('@/features/code-tools/yaml-tools/YamlTools'));
const SqlFormatter = lazy(() => import('@/features/code-tools/sql-formatter/SqlFormatter'));
const HtmlTools = lazy(() => import('@/features/code-tools/html-tools/HtmlTools'));
const CssTools = lazy(() => import('@/features/code-tools/css-tools/CssTools'));
const JsFormatter = lazy(() => import('@/features/code-tools/js-formatter/JsFormatter'));
const JsLinter = lazy(() => import('@/features/code-tools/js-linter/JsLinter'));
const JwtDecoder = lazy(() => import('@/features/code-tools/jwt-decoder/JwtDecoder'));
const Base64Tool = lazy(() => import('@/features/code-tools/base64-tool/Base64Tool'));
const UrlEncoder = lazy(() => import('@/features/code-tools/url-encoder/UrlEncoder'));
const HashGenerator = lazy(() => import('@/features/code-tools/hash-generator/HashGenerator'));
const UuidGenerator = lazy(() => import('@/features/code-tools/uuid-generator/UuidGenerator'));
const LoremGenerator = lazy(() => import('@/features/code-tools/lorem-generator/LoremGenerator'));
const DiffViewer = lazy(() => import('@/features/code-tools/diff-viewer/DiffViewer'));
const ColorConverter = lazy(() => import('@/features/code-tools/color-converter/ColorConverter'));
const CronParser = lazy(() => import('@/features/code-tools/cron-parser/CronParser'));
const MarkdownEditor = lazy(() => import('@/features/code-tools/markdown-editor/MarkdownEditor'));

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Navigate to="/tools/image-studio" replace />} />

        {/* Consolidated Studios */}
        <Route path="/tools/image-studio" element={wrap(ImageStudio)} />
        <Route path="/tools/json-studio" element={wrap(JsonStudio)} />

        {/* Individual Code Tools */}
        <Route path="/tools/xml-tools" element={wrap(XmlTools)} />
        <Route path="/tools/yaml-tools" element={wrap(YamlTools)} />
        <Route path="/tools/sql-formatter" element={wrap(SqlFormatter)} />
        <Route path="/tools/html-tools" element={wrap(HtmlTools)} />
        <Route path="/tools/css-tools" element={wrap(CssTools)} />
        <Route path="/tools/js-formatter" element={wrap(JsFormatter)} />
        <Route path="/tools/js-linter" element={wrap(JsLinter)} />
        <Route path="/tools/jwt-decoder" element={wrap(JwtDecoder)} />
        <Route path="/tools/base64-tool" element={wrap(Base64Tool)} />
        <Route path="/tools/url-encoder" element={wrap(UrlEncoder)} />
        <Route path="/tools/hash-generator" element={wrap(HashGenerator)} />
        <Route path="/tools/uuid-generator" element={wrap(UuidGenerator)} />
        <Route path="/tools/lorem-generator" element={wrap(LoremGenerator)} />
        <Route path="/tools/diff-viewer" element={wrap(DiffViewer)} />
        <Route path="/tools/color-converter" element={wrap(ColorConverter)} />
        <Route path="/tools/cron-parser" element={wrap(CronParser)} />
        <Route path="/tools/markdown-editor" element={wrap(MarkdownEditor)} />
      </Route>
    </Routes>
  );
}