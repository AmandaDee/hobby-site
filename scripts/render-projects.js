/* Escape content at build time; showing project cards needs no browser JS. */
'use strict';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function safeUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('Project links must use HTTPS');
  return escapeHtml(url.href);
}

function renderProject(project) {
  if (![project.title, project.category, project.description, project.repository].every(value => typeof value === 'string' && value.trim()) ||
    !Array.isArray(project.tags) || !project.tags.length || !project.tags.every(tag => typeof tag === 'string' && tag.trim())) {
    throw new Error('A project needs a title, category, description, repository and technology tags');
  }
  if (project.isNew !== undefined && typeof project.isNew !== 'boolean') {
    throw new Error('isNew must be a boolean');
  }
  const e = escapeHtml;
  const liveLink = project.demo ? `
              <a href="${safeUrl(project.demo)}" class="button button-primary" target="_blank" rel="noopener noreferrer" aria-label="Try ${e(project.title)}">Try it out <span aria-hidden="true">↗</span></a>` : '';
  return `      <article class="project-card">
        <div class="project-card-heading">
          <p class="project-number">${e(project.category)}</p>${project.isNew ? '<span class="project-new">New project</span>' : ''}
        </div>
        <div class="project-card-content">
          <p class="project-type">PERSONAL PROJECT</p>
          <h3>${e(project.title)}</h3>
          <p class="project-description">${e(project.description)}</p>${project.note ? `
          <p class="project-note">${e(project.note)}</p>` : ''}
          <div class="project-card-bottom">
            <ul class="tags" aria-label="Technologies used">
${project.tags.map(tag => `              <li>${e(tag)}</li>`).join('\n')}
            </ul>
            <div class="project-actions">${liveLink}
              <a href="${safeUrl(project.repository)}" class="project-link" target="_blank" rel="noopener noreferrer" aria-label="View ${e(project.title)} source code">View code <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </div>
      </article>`;
}

module.exports = {renderProject, escapeHtml};
