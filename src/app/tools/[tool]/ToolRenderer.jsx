'use client';

import { lazy, Suspense, useEffect, useState } from 'react';
import { Loader, Center } from '@mantine/core';
import { useToolHistoryStore } from '@/shared/stores/toolHistory.store';
import ErrorBoundary from '@/shared/components/ErrorBoundary';

const Loading = () => <Center h="60vh"><Loader size="lg" /></Center>;

// Every tool is code-split; only the one being viewed is downloaded.
const LOADERS = {
  'image-studio':        lazy(() => import('@/features/image-tools/ImageStudio')),
  'json-studio':         lazy(() => import('@/features/code-tools/json-studio/JsonStudio')),

  'js-formatter':        lazy(() => import('@/features/code-tools/js-formatter/JsFormatter')),
  'js-linter':           lazy(() => import('@/features/code-tools/js-linter/JsLinter')),
  'html-tools':          lazy(() => import('@/features/code-tools/html-tools/HtmlTools')),
  'sql-formatter':       lazy(() => import('@/features/code-tools/sql-formatter/SqlFormatter')),
  'xml-tools':           lazy(() => import('@/features/code-tools/xml-tools/XmlTools')),
  'yaml-tools':          lazy(() => import('@/features/code-tools/yaml-tools/YamlTools')),
  'markdown-editor':     lazy(() => import('@/features/code-tools/markdown-editor/MarkdownEditor')),
  'diff-viewer':         lazy(() => import('@/features/code-tools/diff-viewer/DiffViewer')),
  'regex-tester':        lazy(() => import('@/features/code-tools/regex-tester/RegexTester')),

  'base64-tool':         lazy(() => import('@/features/code-tools/base64-tool/Base64Tool')),
  'url-encoder':         lazy(() => import('@/features/code-tools/url-encoder/UrlEncoder')),
  'string-escaper':      lazy(() => import('@/features/code-tools/string-escaper/StringEscaper')),
  'number-base':         lazy(() => import('@/features/code-tools/number-base/NumberBase')),
  'timestamp-converter': lazy(() => import('@/features/code-tools/timestamp-converter/TimestampConverter')),
  'color-converter':     lazy(() => import('@/features/code-tools/color-converter/ColorConverter')),
  'cron-parser':         lazy(() => import('@/features/code-tools/cron-parser/CronParser')),

  'uuid-generator':      lazy(() => import('@/features/code-tools/uuid-generator/UuidGenerator')),
  'qr-generator':        lazy(() => import('@/features/code-tools/qr-generator/QrGenerator')),
  'text-tools':          lazy(() => import('@/features/code-tools/text-tools/TextTools')),
  'lorem-generator':     lazy(() => import('@/features/code-tools/lorem-generator/LoremGenerator')),

  'password-tools':      lazy(() => import('@/features/security-tools/password-tools/PasswordTools')),
  'hash-generator':      lazy(() => import('@/features/code-tools/hash-generator/HashGenerator')),
  'bcrypt-tool':         lazy(() => import('@/features/security-tools/bcrypt-tool/BcryptTool')),
  'jwt-decoder':         lazy(() => import('@/features/code-tools/jwt-decoder/JwtDecoder')),
  'aes-crypto':          lazy(() => import('@/features/security-tools/aes-crypto/AesCrypto')),
  'keypair-generator':   lazy(() => import('@/features/security-tools/keypair-generator/KeypairGenerator')),
  'cert-decoder':        lazy(() => import('@/features/security-tools/cert-decoder/CertDecoder')),
  'cipher-lab':          lazy(() => import('@/features/security-tools/cipher-lab/CipherLab')),
  'totp-generator':      lazy(() => import('@/features/security-tools/totp-generator/TotpGenerator')),
  'file-inspector':      lazy(() => import('@/features/security-tools/file-inspector/FileInspector')),
  'metadata-privacy':    lazy(() => import('@/features/security-tools/metadata-privacy/MetadataPrivacy')),
  'url-analyzer':        lazy(() => import('@/features/security-tools/url-analyzer/UrlAnalyzer')),
  'subdomain-finder':    lazy(() => import('@/features/security-tools/subdomain-finder/SubdomainFinder')),
  'security-headers':    lazy(() => import('@/features/security-tools/security-headers/SecurityHeaders')),
  'whois-lookup':        lazy(() => import('@/features/network-tools/whois-lookup/WhoisLookup')),
  'seo-analyzer':        lazy(() => import('@/features/network-tools/seo-analyzer/SeoAnalyzer')),

  'dns-lookup':          lazy(() => import('@/features/network-tools/dns-lookup/DnsLookup')),
  'subnet-calculator':   lazy(() => import('@/features/network-tools/subnet-calculator/SubnetCalculator')),
};

export default function ToolRenderer({ id }) {
  const [mounted, setMounted] = useState(false);
  const addToHistory = useToolHistoryStore((s) => s.addToHistory);

  // Tools rely on browser-only APIs (canvas, Web Crypto, workers), so render them client-side only.
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { addToHistory(id); }, [id, addToHistory]);

  const Component = LOADERS[id];
  if (!mounted || !Component) return <Loading />;

  return (
    <ErrorBoundary key={id}>
      <Suspense fallback={<Loading />}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  );
}
