import IframeWrapper from '@/components/IframeWrapper';

export default function SocialPage() {
  return (
    <div className="h-[calc(100vh-5rem)] w-full">
      {/* Portal app id is `trypost` (route name `social` is UX only). */}
      <IframeWrapper targetApp="trypost" />
    </div>
  );
}
