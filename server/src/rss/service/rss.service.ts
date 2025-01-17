import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  RssRejectRepository,
  RssRepository,
  RssAcceptRepository,
} from '../repository/rss.repository';
import { RssRegisterRequestDto } from '../dto/request/rss-register.dto';
import { EmailService } from '../../common/email/email.service';
import { DataSource } from 'typeorm';
import { Rss, RssReject, RssAccept } from '../entity/rss.entity';
import { FeedCrawlerService } from './feed-crawler.service';
import { RssReadResponseDto } from '../dto/response/rss-all.dto';
import { RssAcceptHistoryResponseDto } from '../dto/response/rss-accept-history.dto';
import { RssRejectHistoryResponseDto } from '../dto/response/rss-reject-history.dto';
import { RssManagementRequestDto } from '../dto/request/rss-management.dto';
import { RejectRssRequestDto } from '../dto/request/rss-reject.dto';

@Injectable()
export class RssService {
  constructor(
    private readonly rssRepository: RssRepository,
    private readonly rssAcceptRepository: RssAcceptRepository,
    private readonly rssRejectRepository: RssRejectRepository,
    private readonly emailService: EmailService,
    private readonly dataSource: DataSource,
    private readonly feedCrawlerService: FeedCrawlerService,
  ) {}

  async createRss(rssRegisterBodyDto: RssRegisterRequestDto) {
    const [alreadyURLRss, alreadyURLBlog] = await Promise.all([
      this.rssRepository.findOne({
        where: {
          rssUrl: rssRegisterBodyDto.rssUrl,
        },
      }),
      this.rssAcceptRepository.findOne({
        where: {
          rssUrl: rssRegisterBodyDto.rssUrl,
        },
      }),
    ]);

    if (alreadyURLRss || alreadyURLBlog) {
      throw new ConflictException(
        alreadyURLRss
          ? '이미 신청된 RSS URL입니다.'
          : '이미 등록된 RSS URL입니다.',
      );
    }

    await this.rssRepository.insert(rssRegisterBodyDto.toEntity());
  }

  async readAllRss() {
    const rssList = await this.rssRepository.find();
    return RssReadResponseDto.toResponseDtoArray(rssList);
  }

  async acceptRss(rssAcceptParamDto: RssManagementRequestDto) {
    const rssId = rssAcceptParamDto.id;
    const rss = await this.rssRepository.findOne({
      where: { id: rssId },
    });

    if (!rss) {
      throw new NotFoundException('존재하지 않는 rss 입니다.');
    }

    const blogPlatform = this.identifyPlatformFromRssUrl(rss.rssUrl);

    const [rssAccept, feeds] = await this.dataSource.transaction(
      async (manager) => {
        const [rssAccept] = await Promise.all([
          manager.save(RssAccept.fromRss(rss, blogPlatform)),
          manager.delete(Rss, rssId),
        ]);
        const feeds = await this.feedCrawlerService.loadRssFeeds(
          rssAccept.rssUrl,
        );
        return [rssAccept, feeds];
      },
    );
    await this.feedCrawlerService.saveRssFeeds(feeds, rssAccept);
    this.emailService.sendMail(rssAccept, true);
  }

  async rejectRss(
    rssRejectParamDto: RssManagementRequestDto,
    rssRejectBodyDto: RejectRssRequestDto,
  ) {
    const rssId = rssRejectParamDto.id;
    const rss = await this.rssRepository.findOne({
      where: { id: rssId },
    });

    if (!rss) {
      throw new NotFoundException('존재하지 않는 rss 입니다.');
    }

    const rejectRss = await this.dataSource.transaction(async (manager) => {
      const [rejectRss] = await Promise.all([
        manager.remove(rss),
        manager.save(RssReject, {
          ...rss,
          description: rssRejectBodyDto.description,
        }),
      ]);
      return rejectRss;
    });
    this.emailService.sendMail(rejectRss, false, rssRejectBodyDto.description);
  }

  async readAcceptHistory() {
    const acceptRssList = await this.rssAcceptRepository.find({
      order: {
        id: 'DESC',
      },
    });
    return RssAcceptHistoryResponseDto.toResponseDtoArray(acceptRssList);
  }

  async readRejectHistory() {
    const rejectRssList = await this.rssRejectRepository.find({
      order: {
        id: 'DESC',
      },
    });
    return RssRejectHistoryResponseDto.toResponseDtoArray(rejectRssList);
  }

  private identifyPlatformFromRssUrl(rssUrl: string) {
    type Platform = 'medium' | 'tistory' | 'velog' | 'github' | 'etc';

    const platformRegexp: { [key in Platform]: RegExp } = {
      medium: /^https:\/\/medium\.com/,
      tistory: /^https:\/\/[a-zA-Z0-9\-]+\.tistory\.com/,
      velog: /^https:\/\/v2\.velog\.io/,
      github: /^https:\/\/[\w\-]+\.github\.io/,
      etc: /.*/,
    };

    for (const platform in platformRegexp) {
      if (platformRegexp[platform].test(rssUrl)) {
        return platform;
      }
    }
    return 'etc';
  }
}
