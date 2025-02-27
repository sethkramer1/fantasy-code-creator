
interface HeaderProps {
  title: string;
  description: string;
}

export function Header({ title, description }: HeaderProps) {
  return (
    <div className="text-center space-y-3">
      <h1 className="text-3xl md:text-4xl font-light tracking-tight text-black">{title}</h1>
      <p className="text-base md:text-lg text-[#757575]">
        {description}
      </p>
    </div>
  );
}
