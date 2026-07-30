import { Link } from 'react-router-dom';

const Breadcrumb = ({ pageName }) => {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-title-md2 text-xl font-semibold text-text">
        {pageName}
      </h2>

      <nav>
        <ol className="flex items-center gap-2">
          <li>
            <Link className="font-medium hover:no-underline" to="/dashboard">
              Dashboard /
            </Link>
          </li>
          <li className="font-medium text-blue-600">{pageName}</li>
        </ol>
      </nav>
    </div>
  );
};

export default Breadcrumb;